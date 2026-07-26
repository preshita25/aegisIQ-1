"""
Baseline Profiler:
Builds per-entity statistical behavioural profiles from historical access logs.
For each entity it learns:
  - Typical login hour distribution
  - Typical geo-locations
  - Typical resource set
  - Session duration statistics
  - Auth failure rate
  - Device fingerprint history

At inference time it scores a new event against the entity profile and returns
a set of interpretable deviation features plus an anomaly score [0, 1].

Handles cold-start (unseen entities) via a global One-Class SVM fallback.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from collections import Counter, defaultdict
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler


# Per-entity profile object

class EntityProfile:
    def __init__(self, entity_id: str, entity_type: str):
        self.entity_id    = entity_id
        self.entity_type  = entity_type
        self.event_count  = 0

        # Hour distribution (24-dim)
        self.hour_counts  = Counter()
        # Geo distribution
        self.geo_counts   = Counter()
        # Resource distribution
        self.resource_counts = Counter()
        # Auth method distribution
        self.auth_method_counts = Counter()
        # Device fingerprints seen
        self.fingerprints = Counter()
        # Session duration stats
        self.durations    = []
        # Auth failures
        self.fail_count   = 0

    def update(self, row: pd.Series):
        ts = pd.to_datetime(row["timestamp"])
        self.hour_counts[ts.hour] += 1
        self.geo_counts[row["geo_location"]] += 1
        self.resource_counts[row["resource_accessed"]] += 1
        self.auth_method_counts[row["auth_method"]] += 1
        self.fingerprints[row["device_fingerprint"]] += 1
        self.durations.append(float(row["session_duration"]))
        if not row["auth_success"]:
            self.fail_count += 1
        self.event_count += 1

    # Derived statistics

    @property
    def typical_hours(self) -> list:
        """Hours that cover 80% of activity."""
        if not self.hour_counts:
            return list(range(9, 18))
        total = sum(self.hour_counts.values())
        sorted_hours = sorted(self.hour_counts, key=lambda h: -self.hour_counts[h])
        cumulative = 0
        typical = []
        for h in sorted_hours:
            typical.append(h)
            cumulative += self.hour_counts[h]
            if cumulative / total >= 0.8:
                break
        return typical

    @property
    def typical_geos(self) -> list:
        return [g for g, _ in self.geo_counts.most_common(3)]

    @property
    def typical_resources(self) -> list:
        return [r for r, _ in self.resource_counts.most_common(10)]

    @property
    def duration_mean(self) -> float:
        return float(np.mean(self.durations)) if self.durations else 10.0

    @property
    def duration_std(self) -> float:
        return float(np.std(self.durations)) if len(self.durations) > 1 else 5.0

    @property
    def fail_rate(self) -> float:
        return self.fail_count / max(self.event_count, 1)

    @property
    def known_fingerprints(self) -> set:
        return set(self.fingerprints.keys())


    # Score a single event — returns dict of deviation features

    def score_event(self, row: pd.Series) -> dict:
        ts = pd.to_datetime(row["timestamp"])
        hour = ts.hour

        # 1. Hour anomaly — is this hour in typical range?
        hour_total = max(sum(self.hour_counts.values()), 1)
        hour_freq = self.hour_counts.get(hour, 0) / hour_total
        hour_anomaly = float(hour_freq < 0.02)  # this hour is very rare for entity

        # 2. Geo anomaly
        geo = row["geo_location"]
        geo_total = max(sum(self.geo_counts.values()), 1)
        geo_freq = self.geo_counts.get(geo, 0) / geo_total
        geo_anomaly = float(geo_freq < 0.01)

        # 3. Resource anomaly
        res = row["resource_accessed"]
        res_total = max(sum(self.resource_counts.values()), 1)
        res_freq = self.resource_counts.get(res, 0) / res_total
        resource_anomaly = float(res_freq < 0.01)

        # 4. Session duration z-score
        dur = float(row["session_duration"])
        dur_std = max(self.duration_std, 0.1)
        dur_zscore = abs(dur - self.duration_mean) / dur_std

        # 5. New device fingerprint
        fp = row["device_fingerprint"]
        new_fingerprint = float(fp not in self.known_fingerprints)

        # 6. Auth failure
        auth_fail = float(not row["auth_success"])

        # 7. New auth method
        am = row["auth_method"]
        am_total = max(sum(self.auth_method_counts.values()), 1)
        am_freq = self.auth_method_counts.get(am, 0) / am_total
        new_auth_method = float(am_freq < 0.01)

        # Composite anomaly score (weighted sum, capped at 1.0)
        score = (
            0.20 * hour_anomaly +
            0.20 * geo_anomaly +
            0.20 * resource_anomaly +
            0.10 * min(dur_zscore / 5.0, 1.0) +
            0.15 * new_fingerprint +
            0.10 * auth_fail +
            0.05 * new_auth_method
        )

        return {
            "hour_anomaly": hour_anomaly,
            "geo_anomaly": geo_anomaly,
            "resource_anomaly": resource_anomaly,
            "dur_zscore": round(dur_zscore, 3),
            "new_fingerprint": new_fingerprint,
            "auth_fail": auth_fail,
            "new_auth_method": new_auth_method,
            "baseline_score": round(min(score, 1.0), 4),
        }


# Baseline Profiler — manages all entity profiles

class BaselineProfiler:
    def __init__(self):
        self.profiles: dict[str, EntityProfile] = {}
        self._ocsvm: OneClassSVM | None = None
        self._scaler: StandardScaler | None = None
        self._global_features: list[list[float]] = []

    def fit(self, df: pd.DataFrame):
        """Build per-entity profiles from historical log dataframe."""
        print("Building per-entity baseline profiles...")
        for _, row in df.iterrows():
            eid = row["entity_id"]
            if eid not in self.profiles:
                self.profiles[eid] = EntityProfile(eid, row["entity_type"])
            self.profiles[eid].update(row)

        # Train global One-Class SVM on normal events for cold-start fallback
        normal = df[df["label"] == "normal"]
        feat_rows = []
        for _, row in normal.iterrows():
            eid = row["entity_id"]
            if eid in self.profiles:
                d = self.profiles[eid].score_event(row)
                feat_rows.append([
                    d["hour_anomaly"], d["geo_anomaly"], d["resource_anomaly"],
                    d["dur_zscore"], d["new_fingerprint"], d["auth_fail"],
                    d["new_auth_method"],
                ])

        self._scaler = StandardScaler()
        X = self._scaler.fit_transform(feat_rows)
        self._ocsvm = OneClassSVM(kernel="rbf", nu=0.05, gamma="scale")
        self._ocsvm.fit(X)
        print(f"  Profiles built: {len(self.profiles)}")
        print(f"  OC-SVM trained on {len(feat_rows):,} normal samples")

    def score(self, row: pd.Series) -> dict:
        """Score a single event. Returns deviation dict + baseline_score."""
        eid = row["entity_id"]

        if eid in self.profiles:
            return self.profiles[eid].score_event(row)
        else:
            # Cold-start: use global OC-SVM
            feats = np.array([[0.5, 0.5, 0.5, 2.0, 1.0, 0.0, 0.0]])
            if self._scaler and self._ocsvm:
                feats_scaled = self._scaler.transform(feats)
                pred = self._ocsvm.predict(feats_scaled)
                ocsvm_score = 0.7 if pred[0] == -1 else 0.2
            else:
                ocsvm_score = 0.5
            return {
                "hour_anomaly": 0.5, "geo_anomaly": 0.5, "resource_anomaly": 0.5,
                "dur_zscore": 2.0, "new_fingerprint": 1.0, "auth_fail": 0.0,
                "new_auth_method": 0.5, "baseline_score": ocsvm_score,
            }

    def score_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Score all events and return dataframe with deviation columns."""
        rows = []
        for _, row in df.iterrows():
            rows.append(self.score(row))
        return pd.DataFrame(rows, index=df.index)

    
    def save(self, path: str = "models/saved/baseline_profiler.pkl"):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self, path)
        print(f"Baseline profiler saved → {path}")

    @staticmethod
    def load(path: str = "models/saved/baseline_profiler.pkl") -> "BaselineProfiler":
        return joblib.load(path)
