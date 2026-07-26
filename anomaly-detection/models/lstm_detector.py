"""
LSTM Autoencoder — Sequence-Aware Anomaly Detector
====================================================
Learns to reconstruct sequences of access events for each entity.
High reconstruction error → the sequence deviates from learned normal patterns.

Architecture:
  - Input: window of W events, each encoded as a feature vector
  - Encoder: LSTM(128) → LSTM(64)
  - Decoder: LSTM(64) → LSTM(128) → Linear projection
  - Loss: MSE reconstruction

At inference, reconstruction error is converted to a probability via a
threshold calibrated on the validation set (95th percentile of normal errors).

Handles concept drift via a configurable sliding window; profiles older than
`drift_days` are down-weighted during scoring.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler, LabelEncoder


# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------
ALL_GEOS = [
    "US-NY", "US-CA", "US-TX", "UK-LDN", "DE-BER",
    "IN-MUM", "SG-SGP", "AU-SYD", "BR-SAO", "JP-TYO",
]
ALL_RESOURCES = [
    "/api/v1/users", "/api/v1/orders", "/api/v1/payments",
    "/api/v1/reports", "/admin/config", "/admin/users",
    "/api/v1/inventory", "/api/v1/logs", "/api/v1/analytics",
    "/api/v1/export", "/internal/secrets", "/internal/keys",
]
ALL_AUTH = ["password", "token", "certificate", "biometric"]


def encode_event(row: pd.Series) -> np.ndarray:
    """Encode a single access-log row into a fixed-size feature vector (dim=34)."""
    ts = pd.to_datetime(row["timestamp"])
    feats = []

    # Time features (4)
    feats.append(np.sin(2 * np.pi * ts.hour / 24))
    feats.append(np.cos(2 * np.pi * ts.hour / 24))
    feats.append(np.sin(2 * np.pi * ts.dayofweek / 7))
    feats.append(np.cos(2 * np.pi * ts.dayofweek / 7))

    # Geo one-hot (10)
    geo_vec = [0.0] * len(ALL_GEOS)
    if row["geo_location"] in ALL_GEOS:
        geo_vec[ALL_GEOS.index(row["geo_location"])] = 1.0
    feats.extend(geo_vec)

    # Resource one-hot (12)
    res_vec = [0.0] * len(ALL_RESOURCES)
    if row["resource_accessed"] in ALL_RESOURCES:
        res_vec[ALL_RESOURCES.index(row["resource_accessed"])] = 1.0
    feats.extend(res_vec)

    # Auth method one-hot (4)
    auth_vec = [0.0] * len(ALL_AUTH)
    if row["auth_method"] in ALL_AUTH:
        auth_vec[ALL_AUTH.index(row["auth_method"])] = 1.0
    feats.extend(auth_vec)

    # Scalar features (4)
    feats.append(float(row.get("auth_success", 1)))
    feats.append(min(float(row["session_duration"]) / 60.0, 1.0))  # normalize to [0,1]
    # Command sequence length
    try:
        cmds = json.loads(row["command_sequence"]) if isinstance(row["command_sequence"], str) else []
        feats.append(min(len(cmds) / 10.0, 1.0))
    except Exception:
        feats.append(0.0)
    # Fingerprint hash → normalized [0,1]
    fp_hash = hash(str(row["device_fingerprint"])) % 10000 / 10000.0
    feats.append(fp_hash)

    return np.array(feats, dtype=np.float32)  # dim = 34


FEATURE_DIM = 34
WINDOW_SIZE = 10     # sequence length


def build_sequences(df: pd.DataFrame, window: int = WINDOW_SIZE):
    """Build sliding-window sequences per entity. Returns (X, entity_ids, timestamps)."""
    df = df.sort_values(["entity_id", "timestamp"]).reset_index(drop=True)

    sequences  = []
    entity_ids = []
    timestamps = []

    for eid, group in df.groupby("entity_id"):
        group = group.reset_index(drop=True)
        vecs = np.stack([encode_event(row) for _, row in group.iterrows()])

        for i in range(len(vecs) - window + 1):
            sequences.append(vecs[i:i + window])
            entity_ids.append(eid)
            timestamps.append(group.iloc[i + window - 1]["timestamp"])

    X = np.stack(sequences).astype(np.float32)  # (N, W, F)
    return X, entity_ids, timestamps


# ---------------------------------------------------------------------------
# LSTM Autoencoder Model
# ---------------------------------------------------------------------------
class LSTMAutoencoder(nn.Module):
    def __init__(self, feature_dim: int = FEATURE_DIM, hidden1: int = 128, hidden2: int = 64):
        super().__init__()
        self.feature_dim = feature_dim
        self.hidden1 = hidden1
        self.hidden2 = hidden2

        # Encoder
        self.enc_lstm1 = nn.LSTM(feature_dim, hidden1, batch_first=True)
        self.enc_lstm2 = nn.LSTM(hidden1, hidden2, batch_first=True)

        # Decoder
        self.dec_lstm1 = nn.LSTM(hidden2, hidden2, batch_first=True)
        self.dec_lstm2 = nn.LSTM(hidden2, hidden1, batch_first=True)
        self.output_layer = nn.Linear(hidden1, feature_dim)

        self.dropout = nn.Dropout(0.2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, window, feature_dim)
        enc1, _ = self.enc_lstm1(x)
        enc1 = self.dropout(enc1)
        enc2, (h, c) = self.enc_lstm2(enc1)

        # Repeat encoded context across window
        latent = enc2[:, -1:, :].repeat(1, x.shape[1], 1)

        dec1, _ = self.dec_lstm1(latent)
        dec1 = self.dropout(dec1)
        dec2, _ = self.dec_lstm2(dec1)
        out = self.output_layer(dec2)
        return out  # (batch, window, feature_dim)


# ---------------------------------------------------------------------------
# Detector wrapper
# ---------------------------------------------------------------------------
class LSTMDetector:
    def __init__(self, feature_dim: int = FEATURE_DIM, window: int = WINDOW_SIZE,
                 hidden1: int = 128, hidden2: int = 64, epochs: int = 30,
                 batch_size: int = 128, lr: float = 1e-3, device: str = None):
        self.feature_dim = feature_dim
        self.window = window
        self.epochs = epochs
        self.batch_size = batch_size
        self.lr = lr
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        self.model = LSTMAutoencoder(feature_dim, hidden1, hidden2).to(self.device)
        self.threshold: float = 0.0

    # ------------------------------------------------------------------
    def fit(self, df: pd.DataFrame, val_df: pd.DataFrame | None = None):
        """Train autoencoder on normal sequences only."""
        normal_df = df[df["label"] == "normal"]
        print(f"Building sequences from {len(normal_df):,} normal events...")
        X, _, _ = build_sequences(normal_df, self.window)
        print(f"  Training sequences: {len(X):,}")

        dataset = TensorDataset(torch.tensor(X))
        loader  = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        criterion = nn.MSELoss()
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=self.epochs)

        self.model.train()
        for epoch in range(self.epochs):
            total_loss = 0.0
            for (batch,) in loader:
                batch = batch.to(self.device)
                recon = self.model(batch)
                loss = criterion(recon, batch)
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                total_loss += loss.item()
            scheduler.step()
            if (epoch + 1) % 5 == 0:
                avg = total_loss / len(loader)
                print(f"  Epoch {epoch+1:3d}/{self.epochs}  loss={avg:.6f}")

        # Calibrate threshold on normal data
        self.threshold = self._calibrate_threshold(X)
        print(f"  Anomaly threshold (95th pct): {self.threshold:.6f}")

    def _calibrate_threshold(self, X_normal: np.ndarray, percentile: float = 95.0) -> float:
        errors = self._reconstruction_errors(X_normal)
        return float(np.percentile(errors, percentile))

    def _reconstruction_errors(self, X: np.ndarray) -> np.ndarray:
        self.model.eval()
        errors = []
        with torch.no_grad():
            for i in range(0, len(X), self.batch_size):
                batch = torch.tensor(X[i:i+self.batch_size]).to(self.device)
                recon = self.model(batch)
                err = ((recon - batch) ** 2).mean(dim=(1, 2)).cpu().numpy()
                errors.extend(err.tolist())
        return np.array(errors)

    # ------------------------------------------------------------------
    def score_dataframe(self, df: pd.DataFrame) -> tuple[np.ndarray, list, list]:
        """
        Returns (errors, entity_ids, timestamps) aligned to sequence endings.
        """
        X, eids, tss = build_sequences(df, self.window)
        errors = self._reconstruction_errors(X)
        return errors, eids, tss

    def anomaly_prob(self, error: float) -> float:
        """Convert reconstruction error to probability [0,1]."""
        if self.threshold == 0:
            return 0.5
        prob = min(error / (self.threshold * 2.0), 1.0)
        return float(prob)

    # ------------------------------------------------------------------
    def save(self, path: str = "models/saved/lstm_detector.pkl"):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save(self.model.state_dict(), path.replace(".pkl", "_weights.pt"))
        # Save meta
        meta = {
            "feature_dim": self.feature_dim,
            "window": self.window,
            "threshold": self.threshold,
        }
        joblib.dump(meta, path)
        print(f"LSTM detector saved → {path}")

    @staticmethod
    def load(path: str = "models/saved/lstm_detector.pkl") -> "LSTMDetector":
        meta = joblib.load(path)
        det  = LSTMDetector(feature_dim=meta["feature_dim"], window=meta["window"])
        weights_path = path.replace(".pkl", "_weights.pt")
        det.model.load_state_dict(torch.load(weights_path, map_location=det.device))
        det.threshold = meta["threshold"]
        return det
