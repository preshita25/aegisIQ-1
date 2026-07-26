# AegisIQ — Technical Report

## Behavioral Anomaly Detection System for Enterprise SOC

---

**Document Type:** Hackathon Deliverable — Assumptions, Metrics & Known Limitations  
**System:** AegisIQ — Enterprise Behavioral Anomaly Detection  
**Training Data Range:** 2024-01-01 to 2024-02-29  
**Report Date:** 2026-07-26  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Behavioural Assumptions & Data Generation](#3-behavioural-assumptions--data-generation)
4. [Model Design](#4-model-design)
   - 4.1 [Baseline Profiler](#41-baseline-profiler)
   - 4.2 [LSTM Autoencoder](#42-lstm-autoencoder)
   - 4.3 [XGBoost Classifier](#43-xgboost-classifier)
5. [Evaluation Metrics](#5-evaluation-metrics)
6. [Explainability & Analyst Usability](#6-explainability--analyst-usability)
7. [Known Limitations](#7-known-limitations)
8. [Conclusion](#8-conclusion)

---

## 1. Executive Summary

AegisIQ is an enterprise-grade behavioral anomaly detection platform designed for Security Operations Centre (SOC) analysts. The system identifies suspicious entity behaviour across users, service accounts, and edge devices by combining statistical baseline profiling, sequence-aware deep learning, and gradient-boosted classification into a unified, explainable detection pipeline.

The system was developed as a proof-of-concept submission for a security ML hackathon. It demonstrates a complete, production-inspired architecture — from synthetic log generation through to an interactive analyst dashboard — with a particular emphasis on interpretability and actionability of alerts.

**Key performance highlights on simulated data:**

| Metric | Value |
|---|---|
| Weighted F1 Score | **98.88%** |
| Binary Precision | **96.51%** |
| Binary Recall | **84.69%** |
| FP Rate @ Top-1% Alert Budget | **0.00%** |
| Total Events Evaluated | 14,387 |
| Total Alerts Generated | 92 |
| Anomaly Rate | 2.71% |

The pipeline achieves near-zero false positives at the top-1% alert threshold — a critical operational requirement for SOC teams managing high alert volumes — while maintaining strong overall precision and recall across seven distinct attack classes.

---

## 2. System Architecture

AegisIQ is structured as a sequential, modular pipeline. Each stage produces enriched feature representations or scored outputs that are consumed by the next stage. The final pipeline is exposed via a FastAPI service layer and visualised through an analyst-facing dashboard.

```
+---------------------------------------------------------------------+
|                        AegisIQ Pipeline                             |
|                                                                     |
|  +------------------+                                               |
|  |  Synthetic Data  |  ~14,387 events                               |
|  |   Generator      |  80 users x 15 svc accts x 25 edge devices   |
|  +--------+---------+  60-day window x 2.5% anomaly injection       |
|           |                                                         |
|           v                                                         |
|  +------------------+                                               |
|  |    Baseline      |  Per-entity statistical profiles              |
|  |    Profiler      |  7 deviation features + composite score       |
|  +--------+---------+  Cold-start: One-Class SVM fallback           |
|           |                                                         |
|           v                                                         |
|  +------------------+                                               |
|  | LSTM Autoencoder |  Sliding window: 10 events x 34 features      |
|  |   (Sequence)     |  Reconstruction error -> anomaly probability  |
|  +--------+---------+  95th-percentile threshold x drift recalib.  |
|           |                                                         |
|           v                                                         |
|  +------------------+                                               |
|  |    XGBoost       |  8-class multiclass classification            |
|  |   Classifier     |  35 engineered features x SMOTE balancing     |
|  +--------+---------+  Calibrated probabilities x severity mapping  |
|           |                                                         |
|           v                                                         |
|  +------------------+                                               |
|  | SHAP Explainer   |  TreeExplainer (exact Shapley values)         |
|  |                  |  25 named features x NL explanation assembly  |
|  +--------+---------+                                               |
|           |                                                         |
|           v                                                         |
|  +------------------+   +--------------------------------------+   |
|  |   FastAPI        |-->|       Analyst Dashboard              |   |
|  |   Service Layer  |   |  5 pages x Alert Queue x Live Score  |   |
|  +------------------+   +--------------------------------------+   |
+---------------------------------------------------------------------+
```

**Component Summary:**

| Component | Module | Role |
|---|---|---|
| Synthetic Generator | `data/generator.py` | Produces labelled event logs simulating realistic enterprise activity |
| Baseline Profiler | `models/baseline_profiler.py` | Builds per-entity behavioural baselines; computes deviation signals |
| LSTM Autoencoder | `models/lstm_detector.py` | Detects sequence-level anomalies via reconstruction error |
| XGBoost Classifier | `models/classifier.py` | Classifies anomaly type and computes calibrated risk scores |
| SHAP Explainer | `models/explainer.py` | Provides exact feature attributions for each alert |
| FastAPI Service | `api/` | Exposes `/score` and pre-computed alert endpoints |
| Dashboard | `dashboard/` | Analyst-facing UI with 5 functional pages |

---

## 3. Behavioural Assumptions & Data Generation

### 3.1 Entity Population

The simulation models **120 entities** across three distinct entity types, each with behavioural properties calibrated to reflect realistic enterprise environments:

| Entity Type | Count | Characteristics |
|---|---|---|
| Users | 80 | Standard working-hours access; geo-constrained to home region |
| Service Accounts | 15 | High-frequency, low-variance access; predictable resource patterns |
| Edge Devices | 25 | Fixed device fingerprints; narrow resource scope |

### 3.2 Simulation Parameters

- **Simulation window:** 60 days (2024-01-01 to 2024-02-29)
- **Events per entity:** approximately 120 (Poisson-sampled)
- **Total events generated:** ~14,387
- **Anomaly injection rate:** 2.5% of sessions overall
- **Geographic regions (10):** US-NY, US-CA, US-TX, UK-LDN, DE-BER, IN-MUM, SG-SGP, AU-SYD, BR-SAO, JP-TYO
- **Resource endpoints (12):** including sensitive paths such as `/admin/config`, `/internal/secrets`, and `/internal/keys`

### 3.3 Feature Schema

Each event record contains the following 11 raw fields:

| Field | Description |
|---|---|
| `timestamp` | UTC event timestamp |
| `entity_id` | Unique entity identifier |
| `entity_type` | `user`, `service_account`, or `edge_device` |
| `geo_location` | One of 10 geographic region codes |
| `resource` | Target resource endpoint accessed |
| `auth_method` | Authentication mechanism used |
| `auth_success` | Boolean — whether authentication succeeded |
| `session_duration` | Session length in seconds |
| `source_ip` | Originating IP address |
| `device_fingerprint` | OS/MAC-derived device identifier |
| `is_offhours` | Boolean — whether event occurred outside business hours |

### 3.4 Attack Taxonomy

The generator injects eight labelled event classes, of which seven represent distinct attack patterns:

| # | Label | Description | Injected Events |
|---|---|---|---|
| 0 | `normal` | Habitual baseline activity | 13,997 |
| 1 | `brute_force` | Rapid failed-auth attempts from a single source IP | 80 |
| 2 | `lateral_movement` | Unusual breadth and sequence of resource accesses | 73 |
| 3 | `credential_stuffing` | Many entity IDs, few source IPs, high authentication failure rate | 69 |
| 4 | `low_and_slow` | Gradual off-hours resource access spread over many days | 56 |
| 5 | `device_spoofing` | Mismatched OS/MAC fingerprint relative to entity history | 50 |
| 6 | `impossible_travel` | Two logins from geographically distant regions within 30 minutes | 48 |
| 7 | `insider_drift` | Slowly expanding privilege footprint over time (rare edge case) | 14 |

**Total anomalous events:** 390 out of 14,387 (~2.71%).

> **Note on class imbalance:** `insider_drift` is intentionally rare (14 samples) to simulate a realistic long-tail detection challenge. This class is the most difficult to learn reliably and warrants particular caution when interpreting model confidence for this label.

### 3.5 Core Assumptions

The following assumptions underpin the data generation and downstream modelling:

1. **Synthetic data only.** Entity behavioural distributions are plausible approximations of enterprise activity. Real-world logs exhibit additional noise, drift, and edge cases not captured here. Production deployment requires retraining on real telemetry.
2. **Static device fingerprints.** Fingerprints are assigned once per entity and do not evolve over time. In production, device fingerprints should be versioned to accommodate legitimate hardware changes.
3. **No real-time streaming.** The pipeline operates in batch mode. Production environments with streaming ingestion would require a Kafka or Flink integration layer.
4. **Accurate IP geolocation.** Geo-velocity and impossible-travel detection assume that source IP addresses faithfully reflect physical location. Spoofed IPs, VPNs, and proxy services are not modelled and would defeat this signal.
5. **Fixed session windows.** The LSTM operates on windows of exactly 10 events. Entities with fewer than 10 events in the evaluation window cannot be scored by the sequence model.
6. **Concept drift handled via threshold recalibration.** The system supports sliding-window threshold updates via the `drift_days` parameter. However, full retraining of the LSTM and XGBoost models is required for sustained production accuracy under significant distribution shift.

---

## 4. Model Design

### 4.1 Baseline Profiler

**Module:** `models/baseline_profiler.py`

The baseline profiler constructs a statistical behavioural fingerprint for each entity from its historical normal events. This profile serves as the primary contextualisation layer for downstream models.

**Per-entity profile contents:**
- Hour-of-day access distribution
- Geographic region frequency
- Resource endpoint frequency
- Session duration statistics (mean, standard deviation)
- Preferred authentication methods
- Observed device fingerprints (set)

**Deviation features computed per event (8 total):**

| Feature | Description |
|---|---|
| `bp_hour_anomaly` | Login hour falls in low-probability region of entity's hour distribution |
| `bp_geo_anomaly` | Geographic region not previously observed for this entity |
| `bp_resource_anomaly` | Resource endpoint not consistent with entity's historical access pattern |
| `bp_dur_zscore` | Z-score of session duration relative to entity's normal distribution |
| `bp_new_fingerprint` | Device fingerprint not previously seen for this entity |
| `bp_auth_fail` | Authentication failure flag |
| `bp_new_auth_method` | Authentication method not previously used by this entity |
| `bp_baseline_score` | Composite weighted deviation score aggregating all individual signals |

**Cold-start handling:** For entities with insufficient history (fewer than a configurable minimum number of events), the profiler falls back to a **One-Class SVM** (hyperparameters: `nu=0.05`, `kernel=rbf`) trained on the global distribution of normal events. This ensures all entities receive a baseline score from the first event onwards.

---

### 4.2 LSTM Autoencoder

**Module:** `models/lstm_detector.py`

The LSTM autoencoder provides sequence-aware anomaly detection by learning to reconstruct normal event sequences. Anomalous sequences produce higher reconstruction errors, which are mapped to a continuous anomaly probability.

**Architecture:**

```
Input: [batch, 10, 34]   <- Sliding window of 10 events x 34 features

Encoder:
  LSTM(input=34, hidden=128)
  LSTM(input=128, hidden=64)
         | latent representation

Decoder:
  LSTM(input=64, hidden=64)
  LSTM(input=64, hidden=128)
  Linear(128 -> 34)

Output: [batch, 10, 34]  <- Reconstructed sequence
Loss: Mean Squared Error (reconstruction error)
```

**Training configuration:**

| Parameter | Value |
|---|---|
| Epochs | 20 |
| Optimizer | Adam |
| Learning rate | 0.001 |
| LR schedule | Cosine annealing |
| Gradient clipping | max_norm = 1.0 |
| Threshold | 95th percentile of validation reconstruction errors |
| Input window | 10 events |
| Feature dimensionality | 34 |

**Anomaly threshold:** Determined as the 95th percentile of reconstruction errors computed on held-out normal sequences. Events exceeding this threshold are assigned elevated anomaly probabilities.

**Concept drift mitigation:** A sliding-window recalibration mechanism, governed by the `drift_days` parameter, periodically updates the reconstruction error threshold without requiring full retraining. This provides a lightweight defence against gradual distributional shift in production.

**Output:** A continuous anomaly probability in the range [0, 1], passed as a feature to the XGBoost classifier.

---

### 4.3 XGBoost Classifier

**Module:** `models/classifier.py`

The XGBoost classifier is the final decision-making component of the pipeline. It performs **8-class multiclass classification** (normal + 7 attack types) using a rich feature set that integrates all upstream signals.

**Feature engineering (35 features total):**
- **Time features:** hour of day, day of week, `is_offhours` flag
- **Geographic features:** one-hot encoded geo_location (10 regions)
- **Resource features:** one-hot encoded resource endpoint (12 endpoints)
- **Authentication features:** auth method, auth success/failure indicator
- **Rolling statistics:** event rate, failure rate, unique resource count over a 1-hour rolling window
- **Baseline profiler scores:** all 8 `bp_*` deviation features
- **LSTM reconstruction error:** continuous anomaly probability from the autoencoder

**Class imbalance handling:** SMOTE (Synthetic Minority Over-sampling Technique) is applied to the training set to generate synthetic minority-class samples, addressing the severe imbalance between the `normal` class (13,997 events) and the rarest attack class, `insider_drift` (14 events).

**Probability calibration:** The classifier outputs calibrated posterior probabilities for each of the 8 classes, enabling reliable risk-score interpretation.

**Severity mapping:**

| Risk Score | Severity Level |
|---|---|
| >= 0.75 | CRITICAL |
| >= 0.50 | HIGH |
| >= 0.25 | MEDIUM |
| < 0.25 | LOW |

---

## 5. Evaluation Metrics

All metrics reported below are derived from `api/stats.json` and reflect performance on the labelled evaluation dataset produced by the synthetic generator.

### 5.1 System-Level Counts

| Metric | Value |
|---|---|
| Total events evaluated | 14,387 |
| Total entities monitored | 120 |
| Total alerts generated | 92 |
| Observed anomaly rate | 2.71% |

### 5.2 Classification Performance

| Metric | Value |
|---|---|
| Weighted F1 Score | **0.9888 (98.88%)** |
| Binary Precision | **0.9651 (96.51%)** |
| Binary Recall | **0.8469 (84.69%)** |
| FP Rate @ Top-1% Alert Budget | **0.00%** |

**Interpretation:**

- The **weighted F1 of 98.88%** reflects strong overall performance across all eight classes. The weighted average accounts for class imbalance by weighting each class's F1 by its support, meaning the numerically dominant `normal` class has the greatest influence on this figure.
- **Binary precision of 96.51%** indicates that, of all events flagged as anomalous, 96.51% are genuine anomalies. This is a critical metric for SOC analysts, as low precision leads to alert fatigue.
- **Binary recall of 84.69%** means that approximately 15.3% of true anomalies are not flagged at the default operating threshold. This reflects a deliberate precision-recall trade-off; recall can be improved by lowering the classification threshold at the cost of increased false positives.
- **FP Rate of 0.00% at the Top-1% budget** is operationally significant: when analysts are constrained to reviewing only the top-ranked 1% of alerts by risk score, zero false positives are presented. This demonstrates the pipeline's ability to rank true anomalies to the top of the alert queue with high confidence.

### 5.3 Ground Truth Label Distribution

| Label | Events | % of Total |
|---|---|---|
| `normal` | 13,997 | 97.29% |
| `brute_force` | 80 | 0.556% |
| `lateral_movement` | 73 | 0.508% |
| `credential_stuffing` | 69 | 0.480% |
| `low_and_slow` | 56 | 0.389% |
| `device_spoofing` | 50 | 0.348% |
| `impossible_travel` | 48 | 0.334% |
| `insider_drift` | 14 | 0.097% |
| **Total** | **14,387** | **100%** |

The distribution reflects the rare-event nature of security anomalies in enterprise environments. The class imbalance ratio between `normal` and `insider_drift` is approximately **1000:1**, representing a canonical extreme-imbalance detection problem.

---

## 6. Explainability & Analyst Usability

### 6.1 SHAP Explainability Layer

**Module:** `models/explainer.py`

AegisIQ integrates SHAP (SHapley Additive exPlanations) as a first-class component of the alert pipeline. The explainability layer uses **TreeExplainer**, which computes **exact Shapley values** for tree-based models such as XGBoost. Unlike approximation-based SHAP methods used for neural networks, TreeExplainer guarantees consistency and efficiency for the XGBoost classifier.

**Key explainability features:**
- **25 named feature labels** with human-readable descriptions registered for display
- **Natural-language explanation assembly** that surfaces the top contributing features in plain English

*Example explanation output:*

```
Flagged due to: new device fingerprint (+0.34), off-hours access at 02:00 (+0.28),
unusual resource /internal/secrets (+0.21)
```

- **Per-class probability breakdown** displayed in the dashboard alert detail panel, enabling analysts to assess alternative hypotheses (e.g., whether an alert is more consistent with `lateral_movement` or `credential_stuffing`)

> **Note on SHAP for neural models:** The LSTM autoencoder's reconstruction error is passed as a scalar feature to XGBoost and is therefore attributed a single SHAP value. The internal attention structure of the LSTM is not decomposed at the feature level. For deep-learning-specific interpretability, gradient-based attribution methods (e.g., Integrated Gradients) would be required.

### 6.2 Analyst Dashboard

The dashboard is an analyst-facing interface comprising five functional pages:

| Page | Description |
|---|---|
| **Dashboard Overview** | KPI summary: Total Alerts, Critical Severity count, Weighted F1, Monitored Entities, Total Events, FP Rate @ Top-1% |
| **Alert Queue** | All alerts ranked by risk score; filterable by severity, attack type, and entity; paginated |
| **Entity Intelligence** | Per-entity view: anomaly count, event count, anomaly rate bar chart |
| **Live Event Scoring** | POST `/score` endpoint interface for real-time single-event scoring with SHAP explanation |
| **Model Info** | Pipeline architecture summary, training metadata, threshold values |

**Alert detail panel** (accessible from Alert Queue) surfaces:
- SHAP factor contribution bar chart (top features)
- Per-class probability breakdown
- Geographic, resource, and authentication metadata
- Entity history timeline

This design prioritises analyst efficiency: every alert arrives with a human-readable rationale, ranked risk score, and sufficient contextual metadata to triage without requiring tool-switching or additional investigation in a separate SIEM.

---

## 7. Known Limitations

The following limitations are acknowledged explicitly. They represent the delta between the current proof-of-concept state and a production-hardened system.

### 7.1 Data & Pipeline Limitations

| # | Limitation | Impact |
|---|---|---|
| L-01 | **No real-time data ingestion.** The pipeline is batch-only. All alerts are pre-computed and served statically. | An active attacker whose events are ingested after the batch run will not be detected until the next execution cycle. |
| L-02 | **LSTM cold-start minimum.** The LSTM autoencoder requires a minimum sliding window of W=10 events per entity before sequence-level scoring activates. New entities receive only baseline profiler and global SVM scores until this threshold is met. | Detection coverage for new entities is degraded during their first W events. |
| L-03 | **SMOTE overfitting risk.** Synthetic minority oversampling generates artificial attack samples. The classifier may have learned to distinguish synthetic SMOTE samples from real normal events rather than the true underlying attack distribution. | May overfit to synthetic attack patterns; precision on novel real-world attack variants may be lower than reported. |
| L-04 | **No API authentication or authorisation.** The FastAPI service has no access controls. | This is a demo system only and must not be deployed in any environment with network exposure without adding an authentication layer (e.g., OAuth2, API keys, mTLS). |
| L-05 | **Dashboard requires manual refresh.** There is no WebSocket or server-sent event mechanism. Analysts must manually reload pages to see updated alert state. | Reduces operational usability in time-sensitive SOC scenarios. |

### 7.2 Model Performance Limitations

| # | Limitation | Impact |
|---|---|---|
| L-06 | **Binary recall of 84.69%.** At the default operating threshold, approximately 15.3% of true anomalies are not flagged. | Missed detections represent genuine security risk. Threshold tuning can recover recall at the cost of precision. |
| L-07 | **Simulated data only.** All models are trained exclusively on synthetically generated logs. Enterprise log distributions vary significantly by industry, tooling, and user population. | Models trained here should be treated as a prototype baseline. Retraining on real telemetry is mandatory before operational deployment. |
| L-08 | **`insider_drift` low confidence.** Only 14 ground-truth samples exist for `insider_drift`. SMOTE produces additional synthetic samples, but the underlying learned representation for this class is unreliable. | Per-class confidence for `insider_drift` alerts is substantially lower than for other attack types. Analysts should treat `insider_drift` classifications with heightened scepticism. |
| L-09 | **Geo-velocity assumes accurate IP geolocation.** Impossible-travel detection relies on mapping source IPs to geographic coordinates. VPNs, Tor, cloud egress IPs, and IPv6 addresses may produce incorrect geo attributions. | Impossible-travel alerts may be suppressed for attackers using geographic obfuscation, and false positives may arise for legitimate VPN users. |
| L-10 | **Concept drift — threshold recalibration only.** The sliding-window drift mechanism updates the LSTM reconstruction error threshold but does not update model weights. Under sustained distributional shift, the XGBoost decision boundary and LSTM encoder representations will become stale. | Full retraining cadence must be scheduled in production (recommended: monthly or event-triggered). |
| L-11 | **Fixed session window size.** The LSTM operates on a fixed window of exactly 10 events. Variable-length sequences — common in real logs where session activity is bursty — are not natively supported. | Entities with very sparse or very dense event rates may not be optimally modelled by a fixed-size window. |

---

## 8. Conclusion

AegisIQ demonstrates a complete, end-to-end behavioral anomaly detection pipeline suitable as a proof-of-concept for enterprise SOC deployment. The system combines three complementary detection modalities — statistical baseline profiling, sequence-aware deep learning, and gradient-boosted classification — with a first-class explainability layer that surfaces actionable, human-readable rationale for every alert.

**Key strengths:**

- **High precision at operational thresholds:** 96.51% binary precision and zero false positives at the Top-1% alert budget directly address the alert fatigue problem that undermines SOC effectiveness.
- **Multi-modal detection coverage:** The three-stage architecture provides overlapping coverage across different attack temporalities — point-in-time anomalies (baseline profiler), short-sequence patterns (LSTM), and complex multi-feature combinations (XGBoost).
- **Interpretability by design:** SHAP-based explanations are not an afterthought but an integral pipeline stage, ensuring analysts can act on every alert without treating the system as a black box.
- **Realistic class taxonomy:** Seven distinct attack types covering a broad threat landscape — from noisy, rapid attacks (brute force, credential stuffing) to stealthy, slow-burn threats (low-and-slow, insider drift) — demonstrate the breadth of detection intent.

**Path to production:**

Transitioning AegisIQ from prototype to production would require, at minimum: (1) retraining all models on real enterprise telemetry; (2) integrating a streaming ingestion layer (e.g., Apache Kafka + Flink); (3) implementing API authentication and authorisation; (4) establishing a model retraining and monitoring cadence; and (5) replacing fixed session windows with variable-length sequence modelling.

Within the constraints of a hackathon submission, AegisIQ establishes a rigorous architectural foundation and delivers measurable, transparent performance across a challenging multi-class imbalanced detection task.

---

*End of Report — AegisIQ Technical Report*
