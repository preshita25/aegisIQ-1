"""
Anomaly Type Classifier
Given a flagged event, classifies it into one of the attack categories:
  - normal
  - brute_force
  - impossible_travel
  - credential_stuffing
  - lateral_movement
  - device_spoofing
  - low_and_slow
  - insider_drift

Uses XGBoost on engineered features combining:
  - Baseline profiler deviation scores
  - LSTM reconstruction error
  - Raw event features (hour, geo, resource, fingerprint, etc.)
  - Rolling aggregate features per entity (session-window statistics)

Handles class imbalance via scale_pos_weight per class and SMOTE oversampling.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score
from imblearn.over_sampling import SMOTE
import xgboost as xgb


LABEL_ORDER = [
    "normal", "brute_force", "impossible_travel", "credential_stuffing",
    "lateral_movement", "device_spoofing", "low_and_slow", "insider_drift",
]


# Feature engineering for classifier

def engineer_features(
    df: pd.DataFrame,
    baseline_scores: pd.DataFrame,
    lstm_errors: np.ndarray | None = None,
    lstm_entity_ids: list | None = None,
) -> pd.DataFrame:
    """
    Build classifier feature matrix from raw events + model outputs.

    Args:
        df: full event dataframe (sorted)
        baseline_scores: output of BaselineProfiler.score_dataframe(df)
        lstm_errors: per-sequence reconstruction errors (may be None for single events)
        lstm_entity_ids: entity_id aligned to lstm_errors

    Returns:
        Feature dataframe aligned to df rows
    """
    df = df.copy().reset_index(drop=True)
    ts = pd.to_datetime(df["timestamp"])

    feats = pd.DataFrame(index=df.index)

    # --- Time features ---
    feats["hour"]         = ts.dt.hour
    feats["hour_sin"]     = np.sin(2 * np.pi * ts.dt.hour / 24)
    feats["hour_cos"]     = np.cos(2 * np.pi * ts.dt.hour / 24)
    feats["dayofweek"]    = ts.dt.dayofweek
    feats["is_weekend"]   = (ts.dt.dayofweek >= 5).astype(int)
    feats["is_offhours"]  = ((ts.dt.hour < 7) | (ts.dt.hour > 21)).astype(int)

    # --- Auth features ---
    feats["auth_success"] = df["auth_success"].astype(int)
    feats["auth_fail"]    = 1 - feats["auth_success"]

    # --- Session ---
    feats["session_dur"]  = df["session_duration"].clip(0, 120)

    # --- Command sequence length ---
    def cmd_len(s):
        try:
            return len(json.loads(s)) if isinstance(s, str) else 0
        except Exception:
            return 0
    feats["cmd_len"] = df["command_sequence"].apply(cmd_len)

    # --- Resource risk score ---
    HIGH_RISK = ["/admin/config", "/admin/users", "/internal/secrets", "/internal/keys"]
    feats["high_risk_resource"] = df["resource_accessed"].isin(HIGH_RISK).astype(int)

    # --- Geo features ---
    KNOWN_GEOS = [
        "US-NY", "US-CA", "US-TX", "UK-LDN", "DE-BER",
        "IN-MUM", "SG-SGP", "AU-SYD", "BR-SAO", "JP-TYO",
    ]
    feats["geo_index"] = df["geo_location"].apply(
        lambda g: KNOWN_GEOS.index(g) if g in KNOWN_GEOS else -1
    )

    # --- Auth method index ---
    AUTH_METHODS = ["password", "token", "certificate", "biometric"]
    feats["auth_method_idx"] = df["auth_method"].apply(
        lambda m: AUTH_METHODS.index(m) if m in AUTH_METHODS else -1
    )

    # --- Fingerprint change (hash-based) ---
    feats["fp_hash"] = df["device_fingerprint"].apply(
        lambda fp: hash(str(fp)) % 100000 / 100000.0
    )

    # --- Rolling entity features (last 10 events) ---
    df["_ts"] = ts
    df["_fail"] = 1 - df["auth_success"].astype(int)

    roll_fail_rate  = []
    roll_dur_std    = []
    roll_geo_change = []
    roll_unique_res = []
    roll_event_rate = []

    for i, row in df.iterrows():
        eid = row["entity_id"]
        cur_ts = row["_ts"]
        window = df[
            (df["entity_id"] == eid) &
            (df["_ts"] <= cur_ts) &
            (df["_ts"] >= cur_ts - pd.Timedelta(hours=1))
        ]

        roll_fail_rate.append(window["_fail"].mean() if len(window) > 0 else 0.0)
        roll_dur_std.append(window["session_duration"].std() if len(window) > 1 else 0.0)
        roll_geo_change.append(window["geo_location"].nunique() if len(window) > 0 else 1)
        roll_unique_res.append(window["resource_accessed"].nunique() if len(window) > 0 else 1)
        roll_event_rate.append(len(window))

    feats["roll_fail_rate"]  = roll_fail_rate
    feats["roll_dur_std"]    = [x if not np.isnan(x) else 0.0 for x in roll_dur_std]
    feats["roll_geo_change"] = roll_geo_change
    feats["roll_unique_res"] = roll_unique_res
    feats["roll_event_rate"] = roll_event_rate

    # --- Baseline profiler scores ---
    for col in baseline_scores.columns:
        feats[f"bp_{col}"] = baseline_scores[col].values

    # --- LSTM reconstruction error (join on entity + approximate timestamp) ---
    if lstm_errors is not None and lstm_entity_ids is not None:
        lstm_map = {}
        for idx, (eid, err) in enumerate(zip(lstm_entity_ids, lstm_errors)):
            lstm_map[eid] = lstm_map.get(eid, [])
            lstm_map[eid].append(err)

        def get_lstm_err(row):
            eid = row["entity_id"]
            if eid in lstm_map and lstm_map[eid]:
                return float(np.mean(lstm_map[eid]))
            return 0.0

        feats["lstm_recon_error"] = df.apply(get_lstm_err, axis=1)
    else:
        feats["lstm_recon_error"] = 0.0

    return feats.fillna(0.0)


# Classifier

class AnomalyClassifier:
    def __init__(self):
        self.model: xgb.XGBClassifier | None = None
        self.label_encoder = LabelEncoder()
        self.feature_names: list[str] = []
        self.classes_: list[str] = []

    def fit(
        self,
        df: pd.DataFrame,
        baseline_scores: pd.DataFrame,
        lstm_errors: np.ndarray | None = None,
        lstm_entity_ids: list | None = None,
    ):
        print("Engineering features for classifier...")
        X = engineer_features(df, baseline_scores, lstm_errors, lstm_entity_ids)
        y_raw = df["label"].values
        self.feature_names = list(X.columns)

        y = self.label_encoder.fit_transform(y_raw)
        self.classes_ = list(self.label_encoder.classes_)

        X_train, X_val, y_train, y_val = train_test_split(
            X.values, y, test_size=0.2, random_state=42, stratify=y
        )

        # SMOTE on training set to handle imbalance
        print("Applying SMOTE for class imbalance...")
        min_count = min(pd.Series(y_train).value_counts())
        k_neighbors = max(1, min(5, min_count - 1))
        smote = SMOTE(random_state=42, k_neighbors=k_neighbors)
        X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
        print(f"  After SMOTE: {len(X_train_res):,} training samples")

        n_classes = len(self.classes_)
        self.model = xgb.XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="mlogloss",
            random_state=42,
            n_jobs=-1,
        )

        print("Training XGBoost classifier...")
        self.model.fit(
            X_train_res, y_train_res,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        y_pred = self.model.predict(X_val)
        y_pred_labels = self.label_encoder.inverse_transform(y_pred)
        y_val_labels  = self.label_encoder.inverse_transform(y_val)

        print("\nClassifier Validation Report:")
        print(classification_report(y_val_labels, y_pred_labels, zero_division=0))

        weighted_f1 = f1_score(y_val_labels, y_pred_labels, average="weighted", zero_division=0)
        print(f"Weighted F1: {weighted_f1:.4f}")
        return weighted_f1

    def predict(self, X: pd.DataFrame) -> tuple[list[str], np.ndarray]:
        """Returns (predicted_labels, class_probabilities)."""
        probs = self.model.predict_proba(X.values)
        preds = self.model.predict(X.values)
        labels = self.label_encoder.inverse_transform(preds)
        return list(labels), probs

    def predict_single(self, feat_row: dict) -> dict:
        """Predict from a feature dict. Returns label + risk score + class probs."""
        X = pd.DataFrame([feat_row])[self.feature_names]
        labels, probs = self.predict(X)
        prob_dict = {cls: float(p) for cls, p in zip(self.classes_, probs[0])}
        # Risk score = 1 - P(normal)
        normal_prob = prob_dict.get("normal", 0.0)
        risk_score = round(1.0 - normal_prob, 4)
        return {
            "predicted_label": labels[0],
            "risk_score": risk_score,
            "class_probabilities": prob_dict,
        }

    def save(self, path: str = "models/saved/classifier.pkl"):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self, path)
        print(f"Classifier saved → {path}")

    @staticmethod
    def load(path: str = "models/saved/classifier.pkl") -> "AnomalyClassifier":
        return joblib.load(path)
