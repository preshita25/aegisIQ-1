"""
Training Pipeline
=================
Run this script to:
  1. Generate synthetic access-log data
  2. Train the baseline profiler
  3. Train the LSTM autoencoder detector
  4. Train the anomaly classifier
  5. Build alert database for the API/dashboard
  6. Print evaluation metrics
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, f1_score,
    precision_score, recall_score, roc_auc_score
)

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.generator import generate_dataset
from models.baseline_profiler import BaselineProfiler
from models.lstm_detector import LSTMDetector, build_sequences, encode_event
from models.classifier import AnomalyClassifier, engineer_features
from models.explainer import AlertExplainer, ATTACK_DESCRIPTIONS, RISK_COLORS

os.makedirs("models/saved", exist_ok=True)
os.makedirs("data", exist_ok=True)
os.makedirs("api", exist_ok=True)


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


# ===========================================================================
# STEP 1: Generate Data
# ===========================================================================
print_header("STEP 1 — Synthetic Data Generation")

if os.path.exists("data/synthetic_logs.csv"):
    print("Found existing dataset, loading...")
    df = pd.read_csv("data/synthetic_logs.csv")
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    with open("data/entity_profiles.json") as f:
        profiles = json.load(f)
    print(f"  Loaded {len(df):,} events, {df['entity_id'].nunique()} entities")
else:
    df, profiles = generate_dataset(output_path="data/synthetic_logs.csv")

# Train/test split (by time — more realistic)
df_sorted = df.sort_values("timestamp")
split_idx  = int(len(df_sorted) * 0.8)
train_df   = df_sorted.iloc[:split_idx].reset_index(drop=True)
test_df    = df_sorted.iloc[split_idx:].reset_index(drop=True)

print(f"\nTrain: {len(train_df):,} events | Test: {len(test_df):,} events")
print(f"Train anomaly rate: {(train_df['label'] != 'normal').mean() * 100:.2f}%")
print(f"Test  anomaly rate: {(test_df['label']  != 'normal').mean() * 100:.2f}%")


# ===========================================================================
# STEP 2: Baseline Profiler
# ===========================================================================
print_header("STEP 2 — Baseline Profiler Training")

profiler = BaselineProfiler()
profiler.fit(train_df)
profiler.save("models/saved/baseline_profiler.pkl")

# Score full dataset
print("Scoring all events with baseline profiler...")
train_bp_scores = profiler.score_dataframe(train_df)
test_bp_scores  = profiler.score_dataframe(test_df)
all_bp_scores   = profiler.score_dataframe(df_sorted)

print(f"  Baseline score — train anomaly mean: "
      f"{train_bp_scores.loc[train_df['label'] != 'normal', 'baseline_score'].mean():.4f}")
print(f"  Baseline score — train normal  mean: "
      f"{train_bp_scores.loc[train_df['label'] == 'normal', 'baseline_score'].mean():.4f}")


# ===========================================================================
# STEP 3: LSTM Detector
# ===========================================================================
print_header("STEP 3 — LSTM Sequence Detector Training")

detector = LSTMDetector(epochs=20, batch_size=256)
detector.fit(train_df)
detector.save("models/saved/lstm_detector.pkl")

# Score test set
print("Computing LSTM reconstruction errors on test set...")
test_errors, test_eids, test_ts = detector.score_dataframe(test_df)
print(f"  Test sequences scored: {len(test_errors):,}")
print(f"  Mean recon error (all): {np.mean(test_errors):.6f}")
print(f"  Anomaly threshold:      {detector.threshold:.6f}")

# Score all for classifier features
print("Computing LSTM errors on full dataset for classifier...")
all_errors, all_eids, all_ts = detector.score_dataframe(df_sorted)


# ===========================================================================
# STEP 4: Anomaly Classifier
# ===========================================================================
print_header("STEP 4 — Anomaly Type Classifier Training")

print("Engineering features...")
all_feats = engineer_features(df_sorted, all_bp_scores, all_errors, all_eids)

# Temporal split for classifier too
train_feats = all_feats.iloc[:split_idx].reset_index(drop=True)
test_feats  = all_feats.iloc[split_idx:].reset_index(drop=True)

classifier = AnomalyClassifier()

# Fit on full training data (with labels)
full_train_for_clf = pd.concat([train_df.reset_index(drop=True), train_feats], axis=1)

# Engineer features again for train only (with proper LSTM errors)
train_errors, train_eids, _ = detector.score_dataframe(train_df)
train_feats_clf = engineer_features(train_df, train_bp_scores, train_errors, train_eids)

weighted_f1 = classifier.fit(
    train_df,
    train_bp_scores,
    train_errors,
    train_eids,
)
classifier.save("models/saved/classifier.pkl")


# ===========================================================================
# STEP 5: Evaluation on Test Set
# ===========================================================================
print_header("STEP 5 — Full Pipeline Evaluation")

# Engineer test features
test_feats_clf = engineer_features(test_df, test_bp_scores, test_errors, test_eids)

y_pred, y_probs = classifier.predict(test_feats_clf)
y_true = test_df["label"].tolist()

print("\nTest Set Classification Report:")
print(classification_report(y_true, y_pred, zero_division=0))

wf1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)
print(f"\nWeighted F1       : {wf1:.4f}")

# Binary anomaly detection metrics
y_true_bin = [0 if y == "normal" else 1 for y in y_true]
y_pred_bin = [0 if y == "normal" else 1 for y in y_pred]
print(f"Binary Precision  : {precision_score(y_true_bin, y_pred_bin, zero_division=0):.4f}")
print(f"Binary Recall     : {recall_score(y_true_bin, y_pred_bin, zero_division=0):.4f}")

# False positive rate at top-1% alert budget
risk_scores = [1.0 - float(p[classifier.classes_.index("normal")]) if "normal" in classifier.classes_ else 0.5
               for p in y_probs]
threshold_1pct = np.percentile(risk_scores, 99)
flagged_1pct = [i for i, s in enumerate(risk_scores) if s >= threshold_1pct]
fp_at_1pct = sum(1 for i in flagged_1pct if y_true_bin[i] == 0)
print(f"FP rate @top-1%   : {fp_at_1pct / max(len(flagged_1pct), 1) * 100:.2f}%  "
      f"({fp_at_1pct}/{len(flagged_1pct)} alerts)")


# ===========================================================================
# STEP 6: Build Alert Database for API
# ===========================================================================
print_header("STEP 6 — Building Alert Database")

explainer = AlertExplainer(classifier)
alerts = []
RISK_THRESH = 0.40

print(f"Generating alerts for events with risk_score >= {RISK_THRESH}...")

for idx, (_, row) in enumerate(test_df.iterrows()):
    feat_row = test_feats_clf.iloc[idx]
    pred_result = classifier.predict_single(feat_row)

    if pred_result["risk_score"] < RISK_THRESH and pred_result["predicted_label"] == "normal":
        continue

    explanation = explainer.explain(feat_row, top_k=5)
    severity = AlertExplainer.risk_score_to_severity(pred_result["risk_score"])
    true_label = row["label"]

    alert = {
        "id": f"ALT-{idx:06d}",
        "timestamp": str(row["timestamp"]),
        "entity_id": row["entity_id"],
        "entity_type": row["entity_type"],
        "geo_location": row["geo_location"],
        "resource_accessed": row["resource_accessed"],
        "auth_method": row["auth_method"],
        "auth_success": bool(row["auth_success"]),
        "session_duration": float(row["session_duration"]),
        "source_ip": row.get("source_ip", "unknown"),
        "risk_score": pred_result["risk_score"],
        "severity": severity,
        "predicted_label": pred_result["predicted_label"],
        "true_label": true_label,
        "class_probabilities": pred_result["class_probabilities"],
        "explanation_summary": explanation["summary"],
        "explanation_factors": explanation["factors"],
        "attack_description": AlertExplainer.get_attack_description(pred_result["predicted_label"]),
        "risk_color": AlertExplainer.get_risk_color(pred_result["predicted_label"]),
        "correct": pred_result["predicted_label"] == true_label,
    }
    alerts.append(alert)

# Sort by risk score descending
alerts.sort(key=lambda a: a["risk_score"], reverse=True)

# Save alert DB
with open("api/alerts_db.json", "w") as f:
    json.dump(alerts, f, indent=2, default=str)

print(f"  Alerts generated: {len(alerts):,}")
print(f"  Correct predictions: {sum(a['correct'] for a in alerts)}/{len(alerts)} "
      f"({sum(a['correct'] for a in alerts)/max(len(alerts),1)*100:.1f}%)")

# Build entity history
print("Building entity history...")
entity_history = {}
for _, row in df_sorted.iterrows():
    eid = row["entity_id"]
    if eid not in entity_history:
        entity_history[eid] = {
            "entity_id": eid,
            "entity_type": row["entity_type"],
            "total_events": 0,
            "anomaly_count": 0,
            "last_seen": None,
            "events": [],
        }
    entry = entity_history[eid]
    entry["total_events"] += 1
    if row["label"] != "normal":
        entry["anomaly_count"] += 1
    entry["last_seen"] = str(row["timestamp"])
    if len(entry["events"]) < 50:  # keep last 50 events per entity
        entry["events"].append({
            "timestamp": str(row["timestamp"]),
            "resource": row["resource_accessed"],
            "geo": row["geo_location"],
            "auth_success": bool(row["auth_success"]),
            "session_dur": float(row["session_duration"]),
            "label": row["label"],
        })

with open("api/entity_history.json", "w") as f:
    json.dump(entity_history, f, indent=2, default=str)

print(f"  Entity histories saved: {len(entity_history)}")

# Save system stats
label_dist = df["label"].value_counts().to_dict()
stats = {
    "total_events": len(df),
    "total_entities": df["entity_id"].nunique(),
    "total_alerts": len(alerts),
    "label_distribution": label_dist,
    "anomaly_rate_pct": round((df["label"] != "normal").mean() * 100, 2),
    "weighted_f1": round(wf1, 4),
    "binary_precision": round(precision_score(y_true_bin, y_pred_bin, zero_division=0), 4),
    "binary_recall": round(recall_score(y_true_bin, y_pred_bin, zero_division=0), 4),
    "fp_rate_top1pct": round(fp_at_1pct / max(len(flagged_1pct), 1) * 100, 2),
    "date_range_start": str(df_sorted["timestamp"].min()),
    "date_range_end": str(df_sorted["timestamp"].max()),
    "trained_at": datetime.now().isoformat(),
}

with open("api/stats.json", "w") as f:
    json.dump(stats, f, indent=2)

print_header("TRAINING COMPLETE ✓")
print(json.dumps({k: v for k, v in stats.items() if k not in ("label_distribution",)}, indent=2))
print("\nNext step: run the API server with:")
print("  uvicorn api.main:app --reload --port 8000")
print("Then open: dashboard/index.html in your browser")
