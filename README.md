# AegisIQ — AI/ML Based Behavioral Anomaly Detection

A full-stack cybersecurity AI system that detects and classifies behavioral anomalies in access logs using sequence-aware ML models and an analyst-facing dashboard.

---

## Architecture

```
Raw Access Events
       │
       ▼
┌──────────────────────┐
│  Synthetic Generator │  ← NumPy + Faker, 8 attack patterns
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Baseline Profiler   │  ← Per-entity stats + One-Class SVM (cold-start)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  LSTM Autoencoder    │  ← Sequence reconstruction error → anomaly prob
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  XGBoost Classifier  │  ← 8-class · SMOTE · SHAP · calibrated risk score
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   FastAPI Backend    │  ← Alerts, entity history, live scoring
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Analyst Dashboard   │  ← Dark-theme SPA, charts, explainability
└──────────────────────┘
```

---

## Model Details

### Baseline Profiler
- Maintains per-entity counters: hour distribution, geo frequency, resource frequency, session duration stats, auth method, device fingerprints
- Computes 7 deviation features per event
- Falls back to global One-Class SVM (nu=0.05) for cold-start entities

### LSTM Autoencoder
- Input: sliding window of 10 events × 34-dimensional feature vectors
- Architecture: Encoder LSTM(128) → LSTM(64) | Decoder LSTM(64) → LSTM(128) → Linear(34)
- Threshold: 95th percentile of reconstruction errors on normal training sequences
- Training: 20 epochs, Adam optimizer, cosine LR schedule, gradient clipping

### XGBoost Classifier
- Features: 35 engineered (time, geo, resource, auth, rolling stats, baseline scores, LSTM error)
- Classes: 8 (normal + 7 attack types)
- Imbalance handling: SMOTE oversampling on training set
- Explainability: SHAP TreeExplainer per alert

---

### Training all models
```
python train.py
```
This will:
1. Generate `~14,000` synthetic access events with 8 attack patterns
2. Build per-entity behavioral profiles
3. Train the LSTM autoencoder (20 epochs)
4. Train the XGBoost classifier with SMOTE
5. Generate alert database → `api/alerts_db.json`
6. Print evaluation metrics

Expected output:
```
  Weighted F1      : 0.87+
  Binary Precision : 0.89+
  Binary Recall    : 0.84+
  FP Rate @Top-1%  : <5%
```

## Attack Taxonomy

| Pattern | Type | Detection Signal |
|---|---|---|
| Normal Baseline | Benign | Habitual hours, consistent geo, typical resources |
| Brute Force | **Anomaly** | Rapid repeated auth failures from single IP |
| Impossible Travel | **Anomaly** | Two logins from distant geos in < 30 minutes |
| Credential Stuffing | **Anomaly** | Many entity IDs, few IPs, high failure rate |
| Lateral Movement | **Anomaly** | Unusual resource breadth/sequence |
| Device Spoofing | **Anomaly** | Mismatched OS/MAC vs. known fingerprint |
| Low & Slow Exfiltration | **Anomaly** | Gradual off-hours resource access over days |
| Insider Drift | **Edge Case** | Slowly expanding privilege footprint |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/stats` | System statistics + model metrics |
| `GET` | `/alerts` | Ranked alert queue (filterable) |
| `GET` | `/alerts/{id}` | Single alert with full explanation |
| `GET` | `/entities` | All entity summaries |
| `GET` | `/entity/{id}` | Entity history + related alerts |
| `GET` | `/label-distribution` | Anomaly type breakdown |
| `POST` | `/score` | Real-time event scoring |

---

## Project Structure

```
AegisIQ-1/
├── data/
│   ├── generator.py          # Synthetic data generator
│   ├── synthetic_logs.csv    # Generated dataset (after train.py)
│   └── entity_profiles.json  # Per-entity behavioral profiles
├── models/
│   ├── baseline_profiler.py  # Statistical profiler + OC-SVM
│   ├── lstm_detector.py      # LSTM autoencoder
│   ├── classifier.py         # XGBoost 8-class classifier
│   ├── explainer.py          # SHAP + natural-language explanations
│   └── saved/                # Serialized model artifacts (after training)
├── api/
│   ├── main.py               # FastAPI backend
│   ├── alerts_db.json        # Alert database (after train.py)
│   ├── entity_history.json   # Entity timeline data
│   └── stats.json            # Model metrics
├── dashboard/
│   ├── index.html            # Analyst dashboard SPA
│   ├── style.css             # Premium dark theme
│   └── app.js                # Dashboard logic
├── train.py                  # Full training pipeline
├── requirements.txt
├── REPORT.md
└── README.md
```

---

## Evaluation Criteria

| Criterion | Approach |
|---|---|
| Detection accuracy on imbalanced labels | SMOTE + weighted XGBoost + F1 metric |
| Correct anomaly-type classification | 8-class XGBoost with calibrated probabilities |
| FP rate at realistic alert budget | Evaluated at top-1% threshold |
| Explainability / analyst usability | SHAP TreeExplainer + natural-language summaries |
| Cold-start entities | One-Class SVM global fallback |
| Concept drift | Sliding-window LSTM threshold recalibration |
| System scalability | FastAPI async + SQLite-ready architecture |

---


## Assumptions & Limitations

1. **Synthetic data**: Real-world distributions may differ; models should be re-trained on real logs
2. **Static entity fingerprints**: In production, fingerprints should be versioned over time
3. **No real-time streaming**: API uses pre-computed alerts; streaming requires Kafka/Flink integration
4. **SHAP approximation**: TreeExplainer is exact for tree models; neural models use approximations
5. **Concept drift**: Currently handled via threshold recalibration; full retraining would be needed in production
