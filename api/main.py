"""
FastAPI Backend
===============
Serves trained model outputs and alert data to the analyst dashboard.

Endpoints:
  GET  /                       — health check
  GET  /stats                  — system statistics
  GET  /alerts                 — ranked alert queue (with filters)
  GET  /alerts/{alert_id}      — single alert detail
  GET  /entity/{entity_id}     — entity history + profile
  GET  /entities               — list all entities (summary)
  POST /score                  — real-time event scoring
  GET  /label-distribution     — anomaly type breakdown
"""

import json
import os
import sys
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Load pre-built databases
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_json(filename: str):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)

alerts_db: list[dict] = load_json("alerts_db.json") or []
entity_history: dict = load_json("entity_history.json") or {}
stats_data: dict = load_json("stats.json") or {}

# Index alerts by ID
alerts_index = {a["id"]: a for a in alerts_db}

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Behavioral Anomaly Detection API",
    description="AI-powered cybersecurity anomaly detection system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ScoreRequest(BaseModel):
    entity_id: str
    entity_type: str = "user"
    timestamp: str = None
    source_ip: str = "0.0.0.0"
    geo_location: str = "US-NY"
    resource_accessed: str = "/api/v1/users"
    auth_method: str = "password"
    auth_success: bool = True
    session_duration: float = 10.0
    command_sequence: str = "[]"
    device_fingerprint: str = "{}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "Behavioral Anomaly Detection API",
        "alerts_loaded": len(alerts_db),
        "entities_loaded": len(entity_history),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/stats")
def get_stats():
    return stats_data or {"error": "stats not available — run train.py first"}


@app.get("/alerts")
def get_alerts(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = Query(None, description="CRITICAL|HIGH|MEDIUM|LOW"),
    label: Optional[str] = Query(None, description="Attack type filter"),
    entity_id: Optional[str] = Query(None),
    min_risk: float = Query(0.0, ge=0.0, le=1.0),
    sort_by: str = Query("risk_score", description="risk_score|timestamp"),
):
    filtered = alerts_db

    if severity:
        filtered = [a for a in filtered if a.get("severity", "").upper() == severity.upper()]
    if label:
        filtered = [a for a in filtered if a.get("predicted_label", "") == label]
    if entity_id:
        filtered = [a for a in filtered if a.get("entity_id", "") == entity_id]
    if min_risk > 0:
        filtered = [a for a in filtered if a.get("risk_score", 0) >= min_risk]

    if sort_by == "timestamp":
        filtered = sorted(filtered, key=lambda a: a.get("timestamp", ""), reverse=True)
    else:
        filtered = sorted(filtered, key=lambda a: a.get("risk_score", 0), reverse=True)

    total = len(filtered)
    page  = filtered[offset: offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "alerts": page,
    }


@app.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    if alert_id not in alerts_index:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alerts_index[alert_id]


@app.get("/entities")
def list_entities(
    limit: int = Query(100, ge=1, le=1000),
    entity_type: Optional[str] = Query(None),
    sort_by: str = Query("anomaly_count"),
):
    entities = list(entity_history.values())
    if entity_type:
        entities = [e for e in entities if e.get("entity_type") == entity_type]

    if sort_by == "anomaly_count":
        entities = sorted(entities, key=lambda e: e.get("anomaly_count", 0), reverse=True)
    elif sort_by == "total_events":
        entities = sorted(entities, key=lambda e: e.get("total_events", 0), reverse=True)

    # Return summary without full event list
    summaries = [
        {
            "entity_id": e["entity_id"],
            "entity_type": e["entity_type"],
            "total_events": e["total_events"],
            "anomaly_count": e["anomaly_count"],
            "anomaly_rate": round(e["anomaly_count"] / max(e["total_events"], 1) * 100, 2),
            "last_seen": e["last_seen"],
        }
        for e in entities[:limit]
    ]
    return {"total": len(entities), "entities": summaries}


@app.get("/entity/{entity_id}")
def get_entity(entity_id: str):
    if entity_id not in entity_history:
        raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")

    entity = entity_history[entity_id]
    # Attach related alerts
    related_alerts = [
        {k: v for k, v in a.items() if k != "explanation_factors"}
        for a in alerts_db if a.get("entity_id") == entity_id
    ][:20]

    return {**entity, "alerts": related_alerts}


@app.get("/label-distribution")
def label_distribution():
    from collections import Counter
    label_counts = Counter(a.get("predicted_label", "unknown") for a in alerts_db)
    total = len(alerts_db)
    return {
        "labels": [
            {
                "label": lbl,
                "count": cnt,
                "pct": round(cnt / max(total, 1) * 100, 2),
            }
            for lbl, cnt in sorted(label_counts.items(), key=lambda x: -x[1])
        ],
        "total_alerts": total,
    }


@app.post("/score")
def score_event(req: ScoreRequest):
    """
    Real-time event scoring endpoint.
    Uses a simplified rule-based scorer when models aren't loaded in-memory.
    For production, load the models at startup.
    """
    risk_score = 0.0
    reasons = []

    # Simple rule-based scoring for real-time demo
    ts = datetime.fromisoformat(req.timestamp or datetime.now().isoformat())
    if ts.hour < 7 or ts.hour > 21:
        risk_score += 0.20
        reasons.append("Off-hours access")

    if not req.auth_success:
        risk_score += 0.25
        reasons.append("Authentication failure")

    high_risk_resources = ["/admin/config", "/admin/users", "/internal/secrets", "/internal/keys"]
    if req.resource_accessed in high_risk_resources:
        risk_score += 0.25
        reasons.append(f"High-risk resource: {req.resource_accessed}")

    unusual_geos = ["BR-SAO", "JP-TYO", "SG-SGP"]
    if req.geo_location in unusual_geos:
        risk_score += 0.15
        reasons.append(f"Unusual geographic location: {req.geo_location}")

    risk_score = min(risk_score, 1.0)

    from models.explainer import AlertExplainer
    severity = AlertExplainer.risk_score_to_severity(risk_score)

    label = "normal"
    if risk_score >= 0.6:
        if not req.auth_success:
            label = "brute_force"
        elif req.resource_accessed in high_risk_resources:
            label = "lateral_movement"
        else:
            label = "device_spoofing"

    return {
        "entity_id": req.entity_id,
        "risk_score": round(risk_score, 4),
        "severity": severity,
        "predicted_label": label,
        "explanation_summary": f"Flagged due to: {', '.join(reasons)}" if reasons else "Normal pattern",
        "reasons": reasons,
        "timestamp": datetime.now().isoformat(),
    }
