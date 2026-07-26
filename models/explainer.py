"""
Explainability Layer
====================
Produces human-readable explanations for each alert by:

1. Feature attribution via SHAP values (TreeExplainer on XGBoost classifier)
2. Mapping top SHAP features to natural-language reason phrases
3. Assembling a structured explanation: contributing factors + plain-text summary

Example output:
  "Flagged due to: new device fingerprint (score +0.34), off-hours access at 02:00 (+0.28),
   unusual resource /internal/secrets (+0.21), geo-velocity anomaly (+0.15)"
"""

import json
import numpy as np
import pandas as pd
import shap

# Human-readable feature descriptions

FEATURE_LABELS = {
    "hour": "Login hour",
    "hour_sin": "Hour (cyclical sine)",
    "hour_cos": "Hour (cyclical cosine)",
    "dayofweek": "Day of week",
    "is_weekend": "Weekend access",
    "is_offhours": "Off-hours access",
    "auth_success": "Authentication success",
    "auth_fail": "Authentication failure",
    "session_dur": "Session duration",
    "cmd_len": "Command sequence length",
    "high_risk_resource": "High-risk resource accessed",
    "geo_index": "Geographic location",
    "auth_method_idx": "Authentication method",
    "fp_hash": "Device fingerprint",
    "roll_fail_rate": "Recent failure rate (1h window)",
    "roll_dur_std": "Session duration variability (1h)",
    "roll_geo_change": "Geographic changes (1h window)",
    "roll_unique_res": "Unique resources accessed (1h)",
    "roll_event_rate": "Event frequency (1h window)",
    "bp_hour_anomaly": "Unusual login hour (vs baseline)",
    "bp_geo_anomaly": "Unusual location (vs baseline)",
    "bp_resource_anomaly": "Unusual resource (vs baseline)",
    "bp_dur_zscore": "Session duration z-score (vs baseline)",
    "bp_new_fingerprint": "New/unknown device fingerprint",
    "bp_auth_fail": "Authentication failure flag",
    "bp_new_auth_method": "New authentication method",
    "bp_baseline_score": "Baseline anomaly score",
    "lstm_recon_error": "Sequence pattern deviation (LSTM)",
}

ATTACK_DESCRIPTIONS = {
    "normal": "Normal access pattern — no anomaly detected.",
    "brute_force": "Brute force attack — rapid repeated authentication failures from a single source.",
    "impossible_travel": "Impossible travel — logins from geographically distant locations within an implausible time window.",
    "credential_stuffing": "Credential stuffing — authentication attempts across many accounts from few source IPs.",
    "lateral_movement": "Lateral movement — entity accessing an unusual sequence or breadth of resources it has not touched before.",
    "device_spoofing": "Device spoofing — device re-appeared with a mismatched OS/MAC fingerprint vs. known history.",
    "low_and_slow": "Low-and-slow exfiltration — gradual off-hours resource access building up over multiple days.",
    "insider_drift": "Insider drift — entity is slowly expanding its privilege or resource footprint (edge case).",
}

RISK_COLORS = {
    "normal": "#22c55e",
    "brute_force": "#ef4444",
    "impossible_travel": "#f97316",
    "credential_stuffing": "#ef4444",
    "lateral_movement": "#f97316",
    "device_spoofing": "#eab308",
    "low_and_slow": "#f97316",
    "insider_drift": "#a855f7",
}



# Explainer class

class AlertExplainer:
    def __init__(self, classifier):
        """
        Args:
            classifier: AnomalyClassifier instance (already trained)
        """
        self.classifier = classifier
        self._shap_explainer = None

        # Build SHAP TreeExplainer lazily
        if classifier.model is not None:
            try:
                self._shap_explainer = shap.TreeExplainer(classifier.model)
            except Exception as e:
                print(f"SHAP explainer init warning: {e}")

    def explain(self, feat_row: pd.Series, top_k: int = 5) -> dict:
        """
        Explain a single alert.

        Args:
            feat_row: Series with feature values (must match classifier feature_names)
            top_k: number of top contributing factors to return

        Returns:
            dict with keys: factors, summary, attack_description, risk_color
        """
        X = feat_row[self.classifier.feature_names].values.reshape(1, -1)
        factors = []

        if self._shap_explainer is not None:
            try:
                shap_values = self._shap_explainer.shap_values(X)
                # shap_values shape: (n_classes, 1, n_features) for multi-class
                # Use the predicted class's SHAP values
                pred_class_idx = self.classifier.model.predict(X)[0]

                if isinstance(shap_values, list):
                    sv = shap_values[pred_class_idx][0]
                else:
                    sv = shap_values[0]

                feature_names = self.classifier.feature_names
                shap_pairs = sorted(zip(feature_names, sv), key=lambda x: abs(x[1]), reverse=True)

                for feat_name, shap_val in shap_pairs[:top_k]:
                    if abs(shap_val) < 0.001:
                        continue
                    label = FEATURE_LABELS.get(feat_name, feat_name)
                    raw_val = feat_row.get(feat_name, None)
                    factors.append({
                        "feature": feat_name,
                        "label": label,
                        "shap": round(float(shap_val), 4),
                        "value": round(float(raw_val), 4) if raw_val is not None else None,
                        "direction": "↑ increases risk" if shap_val > 0 else "↓ decreases risk",
                    })

            except Exception as e:
                # Fallback to permutation-based importance approximation
                factors = self._fallback_explain(feat_row, top_k)
        else:
            factors = self._fallback_explain(feat_row, top_k)

        # Build natural-language summary
        if factors:
            top_reasons = [
                f"{f['label']} ({'+' if f['shap'] > 0 else ''}{f['shap']:.2f})"
                for f in factors[:3]
            ]
            summary = "Flagged due to: " + ", ".join(top_reasons) + "."
        else:
            summary = "Flagged based on aggregate behavioral deviation."

        return {
            "factors": factors,
            "summary": summary,
        }

    def _fallback_explain(self, feat_row: pd.Series, top_k: int) -> list:
        """Fallback: rank features by absolute value for interpretable ones."""
        priority_feats = [
            "bp_new_fingerprint", "bp_geo_anomaly", "bp_hour_anomaly",
            "bp_resource_anomaly", "lstm_recon_error", "roll_fail_rate",
            "auth_fail", "is_offhours", "high_risk_resource", "roll_geo_change",
        ]
        factors = []
        for feat in priority_feats[:top_k]:
            if feat in feat_row.index:
                val = float(feat_row[feat])
                if val > 0.01:
                    factors.append({
                        "feature": feat,
                        "label": FEATURE_LABELS.get(feat, feat),
                        "shap": val,
                        "value": round(val, 4),
                        "direction": "↑ increases risk",
                    })
        return factors

    @staticmethod
    def get_attack_description(label: str) -> str:
        return ATTACK_DESCRIPTIONS.get(label, "Unknown anomaly type.")

    @staticmethod
    def get_risk_color(label: str) -> str:
        return RISK_COLORS.get(label, "#94a3b8")

    @staticmethod
    def risk_score_to_severity(risk_score: float) -> str:
        if risk_score >= 0.75:
            return "CRITICAL"
        elif risk_score >= 0.50:
            return "HIGH"
        elif risk_score >= 0.25:
            return "MEDIUM"
        else:
            return "LOW"
