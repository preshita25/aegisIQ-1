"""
Synthetic Access-Log Data Generator
====================================
Generates per-entity behavioural profiles, then injects attack patterns
at controlled rates (0.5–3% of sessions) with ground-truth labels.

Attack taxonomy:
  - normal           : habitual baseline
  - brute_force      : rapid failed-auth attempts
  - impossible_travel: two logins from distant geos in implausible time
  - credential_stuffing: many entity_ids, few source_ips, high fail rate
  - lateral_movement : unusual resource sequence / breadth
  - device_spoofing  : mismatched device fingerprint
  - low_and_slow     : gradual off-hours resource access over many days
  - insider_drift    : slowly expanding privilege footprint (edge case)
"""

import random
import hashlib
import json
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from faker import Faker

fake = Faker()
np.random.seed(42)
random.seed(42)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
NUM_USERS          = 80
NUM_SERVICE_ACCTS  = 15
NUM_EDGE_DEVICES   = 25
TOTAL_ENTITIES     = NUM_USERS + NUM_SERVICE_ACCTS + NUM_EDGE_DEVICES

DAYS               = 60          # simulation window
EVENTS_PER_ENTITY  = 120         # avg events per entity over the window
ANOMALY_RATE       = 0.025       # 2.5% anomalous sessions overall

GEO_REGIONS = [
    "US-NY", "US-CA", "US-TX", "UK-LDN", "DE-BER",
    "IN-MUM", "SG-SGP", "AU-SYD", "BR-SAO", "JP-TYO",
]
RESOURCES = [
    "/api/v1/users", "/api/v1/orders", "/api/v1/payments",
    "/api/v1/reports", "/admin/config", "/admin/users",
    "/api/v1/inventory", "/api/v1/logs", "/api/v1/analytics",
    "/api/v1/export", "/internal/secrets", "/internal/keys",
]
AUTH_METHODS  = ["password", "token", "certificate", "biometric"]
OS_LIST       = ["Windows 11", "Ubuntu 22.04", "macOS 14", "CentOS 7"]
PROTO_LIST    = ["TLS1.3", "TLS1.2", "SSH", "MQTT"]

# ---------------------------------------------------------------------------
# Helper: stable fingerprint for an entity
# ---------------------------------------------------------------------------
def make_fingerprint(os: str, mac: str, proto: str) -> str:
    return json.dumps({"os": os, "mac": mac, "proto": proto})


def random_mac() -> str:
    return ":".join(f"{random.randint(0, 255):02x}" for _ in range(6))


# ---------------------------------------------------------------------------
# Build per-entity baseline profiles
# ---------------------------------------------------------------------------
def build_entity_profiles():
    profiles = {}
    entity_id_counter = 0

    for _ in range(NUM_USERS):
        eid = f"user_{entity_id_counter:04d}"
        entity_id_counter += 1
        profiles[eid] = {
            "type": "user",
            "typical_geo": random.sample(GEO_REGIONS, k=random.randint(1, 2)),
            "typical_hours": list(range(random.randint(7, 10), random.randint(17, 21))),
            "typical_resources": random.sample(RESOURCES[:8], k=random.randint(2, 5)),
            "auth_method": random.choice(AUTH_METHODS[:3]),
            "os": random.choice(OS_LIST),
            "mac": random_mac(),
            "proto": random.choice(PROTO_LIST),
            "avg_session_min": random.uniform(5, 40),
            "fail_rate": random.uniform(0.0, 0.05),
        }

    for i in range(NUM_SERVICE_ACCTS):
        eid = f"svc_{entity_id_counter:04d}"
        entity_id_counter += 1
        profiles[eid] = {
            "type": "service_account",
            "typical_geo": [random.choice(GEO_REGIONS)],
            "typical_hours": list(range(0, 24)),  # 24/7
            "typical_resources": random.sample(RESOURCES, k=random.randint(1, 3)),
            "auth_method": "token",
            "os": random.choice(OS_LIST),
            "mac": random_mac(),
            "proto": "TLS1.3",
            "avg_session_min": random.uniform(1, 10),
            "fail_rate": random.uniform(0.0, 0.02),
        }

    for i in range(NUM_EDGE_DEVICES):
        eid = f"dev_{entity_id_counter:04d}"
        entity_id_counter += 1
        profiles[eid] = {
            "type": "edge_device",
            "typical_geo": [random.choice(GEO_REGIONS)],
            "typical_hours": list(range(0, 24)),
            "typical_resources": random.sample(RESOURCES[:6], k=random.randint(1, 2)),
            "auth_method": "certificate",
            "os": random.choice(OS_LIST),
            "mac": random_mac(),
            "proto": random.choice(["MQTT", "TLS1.3"]),
            "avg_session_min": random.uniform(0.5, 5),
            "fail_rate": 0.0,
        }

    return profiles


# ---------------------------------------------------------------------------
# Generate a single NORMAL event for an entity
# ---------------------------------------------------------------------------
def normal_event(eid: str, profile: dict, base_time: datetime) -> dict:
    hour = random.choice(profile["typical_hours"])
    minute = random.randint(0, 59)
    day_offset = random.randint(0, DAYS - 1)
    ts = base_time + timedelta(days=day_offset, hours=hour, minutes=minute)

    success = random.random() > profile["fail_rate"]
    resource = random.choice(profile["typical_resources"])
    geo = random.choice(profile["typical_geo"])
    ip = fake.ipv4_private() if geo.startswith("US") else fake.ipv4_public()

    # Command sequence for privileged sessions
    cmds = []
    if resource.startswith("/admin") or resource.startswith("/internal"):
        cmds = random.sample(["ls", "cat", "curl", "grep", "sed", "awk"], k=random.randint(2, 4))

    fingerprint = make_fingerprint(profile["os"], profile["mac"], profile["proto"])
    session_dur = max(0.5, np.random.normal(profile["avg_session_min"], profile["avg_session_min"] * 0.2))

    return {
        "entity_id": eid,
        "entity_type": profile["type"],
        "timestamp": ts.isoformat(),
        "source_ip": ip,
        "geo_location": geo,
        "resource_accessed": resource,
        "auth_method": profile["auth_method"],
        "auth_success": success,
        "session_duration": round(session_dur, 2),
        "command_sequence": json.dumps(cmds),
        "device_fingerprint": fingerprint,
        "label": "normal",
    }


# ---------------------------------------------------------------------------
# Attack pattern generators
# ---------------------------------------------------------------------------
def brute_force_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Rapid repeated failed-auth attempts from one source in short window."""
    events = []
    ts = base_time + timedelta(days=random.randint(0, DAYS - 1), hours=random.randint(0, 23))
    ip = fake.ipv4_public()
    for i in range(random.randint(8, 20)):
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (ts + timedelta(seconds=i * random.randint(2, 15))).isoformat(),
            "source_ip": ip,
            "auth_success": False,
            "session_duration": round(random.uniform(0.1, 0.5), 2),
            "label": "brute_force",
        })
        events.append(evt)
    # Possibly a successful login at end
    if random.random() > 0.4:
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (ts + timedelta(seconds=i * 15 + 5)).isoformat(),
            "source_ip": ip,
            "auth_success": True,
            "label": "brute_force",
        })
        events.append(evt)
    return events


def impossible_travel_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Two logins from geographically distant locations within implausible time gap."""
    geo1, geo2 = random.sample([g for g in GEO_REGIONS if g not in profile["typical_geo"]] or GEO_REGIONS, k=2)
    ts = base_time + timedelta(days=random.randint(1, DAYS - 2), hours=random.randint(8, 20))
    gap_minutes = random.randint(3, 25)  # impossibly short

    events = []
    for geo, delta in [(geo1, 0), (geo2, gap_minutes)]:
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (ts + timedelta(minutes=delta)).isoformat(),
            "geo_location": geo,
            "source_ip": fake.ipv4_public(),
            "label": "impossible_travel",
        })
        events.append(evt)
    return events


def credential_stuffing_events(profiles: dict, base_time: datetime) -> list:
    """Many entity_ids from few source_ips, high failure rate."""
    events = []
    shared_ips = [fake.ipv4_public() for _ in range(random.randint(1, 3))]
    targets = random.sample(list(profiles.keys()), k=random.randint(10, 25))
    ts = base_time + timedelta(days=random.randint(0, DAYS - 1))

    for i, eid in enumerate(targets):
        profile = profiles[eid]
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (ts + timedelta(seconds=i * random.randint(5, 30))).isoformat(),
            "source_ip": random.choice(shared_ips),
            "auth_success": random.random() > 0.85,
            "session_duration": round(random.uniform(0.1, 1.0), 2),
            "label": "credential_stuffing",
        })
        events.append(evt)
    return events


def lateral_movement_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Entity accesses unusual sequence/breadth of resources it never touched before."""
    unusual = [r for r in RESOURCES if r not in profile["typical_resources"]]
    if len(unusual) < 3:
        unusual = RESOURCES
    resources = random.sample(unusual, k=random.randint(4, 7))
    ts = base_time + timedelta(days=random.randint(0, DAYS - 1), hours=random.randint(1, 5))
    events = []
    for i, res in enumerate(resources):
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (ts + timedelta(minutes=i * random.randint(2, 10))).isoformat(),
            "resource_accessed": res,
            "auth_success": True,
            "label": "lateral_movement",
        })
        events.append(evt)
    return events


def device_spoofing_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Device re-appears with mismatched fingerprint (different OS/MAC than history)."""
    alt_os = random.choice([o for o in OS_LIST if o != profile["os"]])
    alt_mac = random_mac()
    alt_proto = random.choice([p for p in PROTO_LIST if p != profile["proto"]])
    spoof_fp = make_fingerprint(alt_os, alt_mac, alt_proto)

    events = []
    for _ in range(random.randint(2, 5)):
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "device_fingerprint": spoof_fp,
            "label": "device_spoofing",
        })
        events.append(evt)
    return events


def low_and_slow_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Gradual, small, off-hours resource access building over days/weeks."""
    unusual = [r for r in RESOURCES if r not in profile["typical_resources"]]
    if not unusual:
        unusual = RESOURCES
    events = []
    start_day = random.randint(0, DAYS // 2)
    for day in range(start_day, min(start_day + random.randint(10, 20), DAYS)):
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": (base_time + timedelta(
                days=day,
                hours=random.choice([1, 2, 3, 22, 23]),
                minutes=random.randint(0, 59)
            )).isoformat(),
            "resource_accessed": random.choice(unusual),
            "session_duration": round(random.uniform(0.5, 3.0), 2),
            "label": "low_and_slow",
        })
        events.append(evt)
    return events


def insider_drift_events(eid: str, profile: dict, base_time: datetime) -> list:
    """Legitimate entity slowly expanding privilege/resource footprint — edge case."""
    extra = [r for r in RESOURCES if r not in profile["typical_resources"]]
    if not extra:
        extra = ["/admin/config"]
    events = []
    for i, res in enumerate(extra[:random.randint(2, 4)]):
        ts = base_time + timedelta(days=random.randint(i * 5, (i + 1) * 8))
        evt = normal_event(eid, profile, base_time)
        evt.update({
            "timestamp": ts.isoformat(),
            "resource_accessed": res,
            "label": "insider_drift",
        })
        events.append(evt)
    return events


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------
def generate_dataset(n_events: int = None, output_path: str = "data/synthetic_logs.csv") -> pd.DataFrame:
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print("Building entity profiles...")
    profiles = build_entity_profiles()
    entity_ids = list(profiles.keys())

    base_time = datetime(2024, 1, 1, 0, 0, 0)
    all_events = []

    target = n_events or (TOTAL_ENTITIES * EVENTS_PER_ENTITY)
    print(f"Generating ~{target} events for {len(entity_ids)} entities...")

    # --- Normal events ---
    for eid, profile in profiles.items():
        n = int(np.random.normal(EVENTS_PER_ENTITY, EVENTS_PER_ENTITY * 0.2))
        n = max(30, n)
        for _ in range(n):
            all_events.append(normal_event(eid, profile, base_time))

    # --- Inject anomalies ---
    anomaly_budget = int(len(all_events) * ANOMALY_RATE)
    print(f"Injecting ~{anomaly_budget} anomalous events...")

    per_type = anomaly_budget // 7

    # Brute force
    for _ in range(per_type // 8):
        eid = random.choice(entity_ids)
        all_events.extend(brute_force_events(eid, profiles[eid], base_time))

    # Impossible travel
    for _ in range(per_type // 2):
        eid = random.choice(entity_ids)
        all_events.extend(impossible_travel_events(eid, profiles[eid], base_time))

    # Credential stuffing
    for _ in range(3):
        all_events.extend(credential_stuffing_events(profiles, base_time))

    # Lateral movement
    for _ in range(per_type // 4):
        eid = random.choice(entity_ids)
        all_events.extend(lateral_movement_events(eid, profiles[eid], base_time))

    # Device spoofing
    for _ in range(per_type // 3):
        eid = random.choice(entity_ids)
        all_events.extend(device_spoofing_events(eid, profiles[eid], base_time))

    # Low and slow
    for _ in range(per_type // 10):
        eid = random.choice(entity_ids)
        all_events.extend(low_and_slow_events(eid, profiles[eid], base_time))

    # Insider drift
    for _ in range(per_type // 10):
        eid = random.choice(entity_ids)
        all_events.extend(insider_drift_events(eid, profiles[eid], base_time))

    df = pd.DataFrame(all_events)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Save entity profiles as JSON
    import json
    profiles_path = output_path.replace("synthetic_logs.csv", "entity_profiles.json")
    with open(profiles_path, "w") as f:
        json.dump(profiles, f, indent=2)

    df.to_csv(output_path, index=False)

    label_counts = df["label"].value_counts()
    print("\nDataset summary:")
    print(f"  Total events : {len(df):,}")
    print(f"  Entities     : {df['entity_id'].nunique()}")
    print(f"  Date range   : {df['timestamp'].min().date()} → {df['timestamp'].max().date()}")
    print("\nLabel distribution:")
    for label, count in label_counts.items():
        pct = count / len(df) * 100
        print(f"  {label:<25} {count:>6,}  ({pct:.2f}%)")

    return df, profiles


if __name__ == "__main__":
    df, profiles = generate_dataset(output_path="data/synthetic_logs.csv")
