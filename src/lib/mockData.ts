import type {
  Alert,
  AttackType,
  EnterpriseUser,
  LogEntry,
  Scenario,
} from './types';

export const ANALYST = {
  name: 'Preshita Nalawade',
  role: 'SOC Analyst',
  email: 'preshita.nalawade@honeywell.com',
  team: 'Global SOC · Tier 2',
  avatarColor: '#3b82f6',
};

const hours = Array.from({ length: 24 }, (_, h) => h);

function genLoginPattern(peakStart: number, peakEnd: number): { hour: number; intensity: number }[] {
  return hours.map((h) => {
    let v = 0.05;
    if (h >= peakStart && h <= peakEnd) v = 0.6 + Math.random() * 0.4;
    else if (h >= peakStart - 2 && h <= peakEnd + 2) v = 0.2 + Math.random() * 0.3;
    else v = Math.random() * 0.1;
    return { hour: h, intensity: Math.round(v * 100) / 100 };
  });
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function genWeekly(base: number): { day: string; value: number }[] {
  return days.map((d, i) => ({
    day: d,
    value: i >= 5 ? Math.round(base * 0.2) : Math.round(base * (0.8 + Math.random() * 0.4)),
  }));
}
function genTrend(base: number, drift: number): { day: string; value: number }[] {
  return days.map((d) => ({
    day: d,
    value: Math.max(0, Math.round(base + drift + (Math.random() - 0.5) * 15)),
  }));
}
function genDownload(weeks: string[]): { week: string; value: number }[] {
  return weeks.map((w) => ({ week: w, value: Math.round(20 + Math.random() * 80) }));
}

export const USERS: EnterpriseUser[] = [
  {
    id: 'u-fin-001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@honeywell.com',
    department: 'Finance',
    role: 'Finance Manager',
    title: 'VP, Corporate Finance',
    avatarColor: '#3b82f6',
    behaviorScore: 82,
    confidence: 94,
    trustedDevices: [
      { id: 'd1', name: 'MacBook Pro 16"', type: 'laptop', os: 'macOS 14.4', trusted: true, lastSeen: '2 min ago' },
      { id: 'd2', name: 'iPhone 15 Pro', type: 'mobile', os: 'iOS 17.4', trusted: true, lastSeen: '1 min ago' },
    ],
    locations: ['Bengaluru, IN', 'Mumbai, IN', 'Pune, IN'],
    applications: ['SAP S/4HANA', 'Oracle ERP', 'Workday', 'Office 365', 'ServiceNow'],
    loginPattern: genLoginPattern(9, 18),
    weeklyActivity: genWeekly(120),
    downloadTrend: genDownload(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']),
    departmentBaseline: 78,
    personalBaseline: 82,
    driftTrend: genTrend(10, 5),
    coldStart: false,
  },
  {
    id: 'u-eng-002',
    name: 'Sofia Romano',
    email: 'sofia.romano@honeywell.com',
    department: 'Engineering',
    role: 'Principal Engineer',
    title: 'Principal Software Engineer',
    avatarColor: '#22c55e',
    behaviorScore: 91,
    confidence: 97,
    trustedDevices: [
      { id: 'd3', name: 'ThinkPad X1 Carbon', type: 'laptop', os: 'Ubuntu 22.04', trusted: true, lastSeen: '5 min ago' },
      { id: 'd4', name: 'Pixel 8 Pro', type: 'mobile', os: 'Android 14', trusted: true, lastSeen: '3 min ago' },
    ],
    locations: ['Bengaluru, IN', 'Remote', 'Hyderabad, IN'],
    applications: ['GitHub', 'Jira', 'AWS Console', 'Slack', 'VS Code Server', 'Grafana'],
    loginPattern: genLoginPattern(10, 22),
    weeklyActivity: genWeekly(180),
    downloadTrend: genDownload(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']),
    departmentBaseline: 85,
    personalBaseline: 91,
    driftTrend: genTrend(8, -2),
    coldStart: false,
  },
  {
    id: 'u-hr-003',
    name: 'Marcus Chen',
    email: 'marcus.chen@honeywell.com',
    department: 'HR',
    role: 'HR Director',
    title: 'Director, People Operations',
    avatarColor: '#f97316',
    behaviorScore: 74,
    confidence: 88,
    trustedDevices: [
      { id: 'd5', name: 'Dell Latitude 7440', type: 'laptop', os: 'Windows 11', trusted: true, lastSeen: '12 min ago' },
    ],
    locations: ['Bengaluru, IN', 'Chennai, IN'],
    applications: ['Workday', 'SAP SuccessFactors', 'Office 365', 'Zoom'],
    loginPattern: genLoginPattern(8, 17),
    weeklyActivity: genWeekly(95),
    downloadTrend: genDownload(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']),
    departmentBaseline: 72,
    personalBaseline: 74,
    driftTrend: genTrend(12, 8),
    coldStart: false,
  },
  {
    id: 'u-leg-004',
    name: 'Priya Iyer',
    email: 'priya.iyer@honeywell.com',
    department: 'Legal',
    role: 'Senior Counsel',
    title: 'Senior Legal Counsel',
    avatarColor: '#a855f7',
    behaviorScore: 88,
    confidence: 92,
    trustedDevices: [
      { id: 'd6', name: 'MacBook Air M3', type: 'laptop', os: 'macOS 14.4', trusted: true, lastSeen: '8 min ago' },
      { id: 'd7', name: 'iPad Pro', type: 'tablet', os: 'iPadOS 17.4', trusted: true, lastSeen: '1 hr ago' },
    ],
    locations: ['Bengaluru, IN', 'Delhi, IN'],
    applications: ['DocuSign', 'iManage', 'Office 365', 'Teams'],
    loginPattern: genLoginPattern(9, 19),
    weeklyActivity: genWeekly(70),
    downloadTrend: genDownload(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']),
    departmentBaseline: 80,
    personalBaseline: 88,
    driftTrend: genTrend(6, -1),
    coldStart: false,
  },
  {
    id: 'u-ops-005',
    name: 'Daniel Park',
    email: 'daniel.park@honeywell.com',
    department: 'Operations',
    role: 'Operations Lead',
    title: 'Lead, Supply Chain Ops',
    avatarColor: '#06b6d4',
    behaviorScore: 45,
    confidence: 41,
    trustedDevices: [],
    locations: ['Bengaluru, IN'],
    applications: ['ServiceNow', 'Office 365'],
    loginPattern: genLoginPattern(8, 18),
    weeklyActivity: genWeekly(60),
    downloadTrend: genDownload(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']),
    departmentBaseline: 70,
    personalBaseline: 45,
    driftTrend: genTrend(20, 15),
    coldStart: true,
  },
];

export function getUser(id: string): EnterpriseUser | undefined {
  return USERS.find((u) => u.id === id);
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'credential_misuse',
    name: 'Credential Misuse',
    description: 'Valid credentials used from an untrusted device and atypical location, accessing sensitive finance applications beyond the user\'s normal scope.',
    expectedDetection: 'Behavioral deviation in device trust + application access scope',
    difficulty: 'Medium',
    icon: 'KeyRound',
    targetUser: 'Aarav Mehta',
    targetUserId: 'u-fin-001',
  },
  {
    id: 'brute_force',
    name: 'Brute Force',
    description: 'Sustained password guessing against an engineering SSO endpoint from a rotating IP pool, triggering MFA challenges and lockout thresholds.',
    expectedDetection: 'High-velocity failed authentications + IP rotation pattern',
    difficulty: 'Low',
    icon: 'Hammer',
    targetUser: 'Sofia Romano',
    targetUserId: 'u-eng-002',
  },
  {
    id: 'impossible_travel',
    name: 'Impossible Travel',
    description: 'A single identity authenticates from Bengaluru and London within 23 minutes — physically impossible, indicating token replay or session hijacking.',
    expectedDetection: 'Geospatial velocity exceeds travel feasibility threshold',
    difficulty: 'Medium',
    icon: 'Plane',
    targetUser: 'Marcus Chen',
    targetUserId: 'u-hr-003',
  },
  {
    id: 'lateral_movement',
    name: 'Lateral Movement',
    description: 'Compromised engineering account pivots through internal hosts, enumerating shares and attempting WMI/RDP to reach a finance database server.',
    expectedDetection: 'East-west traffic anomalies + privileged share enumeration',
    difficulty: 'High',
    icon: 'Network',
    targetUser: 'Sofia Romano',
    targetUserId: 'u-eng-002',
  },
  {
    id: 'device_spoofing',
    name: 'Device Spoofing',
    description: 'Adversary presents a forged device fingerprint matching a trusted asset to bypass conditional access, while TLS JA3 hash diverges from baseline.',
    expectedDetection: 'Device fingerprint mismatch + JA3 inconsistency',
    difficulty: 'High',
    icon: 'Smartphone',
    targetUser: 'Priya Iyer',
    targetUserId: 'u-leg-004',
  },
];

const baseTime = new Date('2026-07-25T09:14:00');

function ts(offsetMin: number): string {
  return new Date(baseTime.getTime() + offsetMin * 60000).toISOString();
}
function tsLabel(offsetMin: number): string {
  return new Date(baseTime.getTime() + offsetMin * 60000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const INITIAL_ALERTS: Alert[] = [
  {
    id: 'AEG-2026-0725-0142',
    title: 'Credential Misuse — Finance Application Access from Untrusted Device',
    attackType: 'credential_misuse',
    severity: 'high',
    status: 'new',
    user: 'Aarav Mehta',
    userId: 'u-fin-001',
    timestamp: ts(-4),
    riskScore: 78,
    confidence: 94,
    classification: 'Credential Misuse · Valid Account Abuse',
    location: 'Singapore, SG',
    device: 'Unknown · Windows 11',
    description:
      'Valid credentials for Aarav Mehta authenticated from an untrusted device in Singapore. Session accessed SAP S/4HANA and attempted a bulk export of vendor payment records — behavior inconsistent with the user\'s 90-day baseline.',
    contributors: [
      { label: 'Untrusted Device', weight: 24, reason: 'Device fingerprint has no prior history for this user; all trusted devices are macOS/iOS.' },
      { label: 'Geo Anomaly', weight: 19, reason: 'Singapore login is 3,400 km from the user\'s learned location cluster (Bengaluru, Mumbai, Pune).' },
      { label: 'Off-Hours Access', weight: 14, reason: 'Login at 03:14 local time — outside the user\'s 09:00–18:00 IST activity window.' },
      { label: 'Application Scope Drift', weight: 12, reason: 'First observed access to vendor payment export endpoint in 90 days.' },
      { label: 'Data Exfiltration Signal', weight: 9, reason: 'Bulk export volume 4.2× the user\'s 30-day median download size.' },
    ],
    timeline: [
      { id: 't1', time: tsLabel(-42), type: 'login', title: 'Login · SSO', description: 'Authentication succeeded for aarav.mehta@honeywell.com via Azure AD SSO.', severity: 'info' },
      { id: 't2', time: tsLabel(-41), type: 'mfa', title: 'MFA Challenge', description: 'Push notification approved on an unregistered authenticator (device id FP-9X2).', severity: 'medium' },
      { id: 't3', time: tsLabel(-39), type: 'unknown_device', title: 'Unknown Device', description: 'Windows 11 device fingerprint not in trusted device set. JA3 hash diverges from baseline.', severity: 'high' },
      { id: 't4', time: tsLabel(-37), type: 'file_access', title: 'SAP S/4HANA Access', description: 'Accessed Vendor Payment module — first observed scope expansion in 90 days.', severity: 'medium' },
      { id: 't5', time: tsLabel(-34), type: 'download', title: 'Bulk Export', description: 'Exported 1,840 vendor payment records (4.2× baseline median).', severity: 'high' },
      { id: 't6', time: tsLabel(-30), type: 'alert', title: 'Alert Generated', description: 'AegisIQ behavioral engine raised AEG-2026-0725-0142 — Risk 78 / Confidence 94.', severity: 'critical' },
    ],
    recommendedActions: ['Lock Account', 'Reset Password', 'Block Device', 'Notify SOC', 'Escalate to Tier 3'],
  },
  {
    id: 'AEG-2026-0725-0138',
    title: 'Impossible Travel — Bengaluru → London in 23 minutes',
    attackType: 'impossible_travel',
    severity: 'critical',
    status: 'investigating',
    user: 'Marcus Chen',
    userId: 'u-hr-003',
    timestamp: ts(-9),
    riskScore: 91,
    confidence: 96,
    classification: 'Impossible Travel · Session Replay Suspected',
    location: 'London, UK',
    device: 'Unknown · macOS 14',
    description:
      'Marcus Chen\'s identity authenticated from Bengaluru and London within 23 minutes — geospatial velocity exceeds any feasible travel. Session replay or token theft indicated.',
    contributors: [
      { label: 'Geospatial Velocity', weight: 38, reason: 'Bengaluru→London distance 8,047 km covered in 23 min — velocity 20,970 km/h, physically impossible.' },
      { label: 'Session Continuity', weight: 22, reason: 'Both sessions share the same refresh token — consistent with session replay, not a new login.' },
      { label: 'New Geo', weight: 16, reason: 'London has zero appearances in the user\'s 180-day location history.' },
      { label: 'HR Data Access', weight: 15, reason: 'London session queried executive compensation records — high-sensitivity scope.' },
    ],
    timeline: [
      { id: 't1', time: tsLabel(-32), type: 'login', title: 'Login · Bengaluru', description: 'Successful SSO from trusted device (Dell Latitude 7440).', severity: 'info' },
      { id: 't2', time: tsLabel(-9), type: 'impossible_travel', title: 'Login · London', description: 'Second authentication from London using same refresh token.', severity: 'critical' },
      { id: 't3', time: tsLabel(-9), type: 'alert', title: 'Alert Generated', description: 'Impossible travel detection triggered. Risk 91 / Confidence 96.', severity: 'critical' },
    ],
    recommendedActions: ['Lock Account', 'Revoke Sessions', 'Block Device', 'Notify SOC', 'Escalate to IR'],
  },
  {
    id: 'AEG-2026-0725-0129',
    title: 'Brute Force — 1,240 failed authentications in 4 minutes',
    attackType: 'brute_force',
    severity: 'medium',
    status: 'investigating',
    user: 'Sofia Romano',
    userId: 'u-eng-002',
    timestamp: ts(-18),
    riskScore: 62,
    confidence: 89,
    classification: 'Brute Force · Password Spraying',
    location: 'Rotating · TOR exit nodes',
    device: 'N/A',
    description:
      'Sustained password-guessing against the engineering SSO endpoint. 1,240 failed attempts across 87 source IPs in 4 minutes, triggering adaptive lockout and MFA challenge flood.',
    contributors: [
      { label: 'Authentication Velocity', weight: 28, reason: '1,240 failures in 240 seconds — 5.1 attempts/sec, far above the 0.2/sec baseline.' },
      { label: 'IP Rotation', weight: 18, reason: '87 distinct source IPs in 4 minutes — consistent with a botnet or proxy pool.' },
      { label: 'Account Enumeration', weight: 10, reason: 'Attempts target 14 distinct engineering accounts, not a single identity.' },
      { label: 'TOR Egress', weight: 6, reason: '62% of source IPs are known TOR exit nodes.' },
    ],
    timeline: [
      { id: 't1', time: tsLabel(-22), type: 'login', title: 'Failed Auth Burst', description: 'First wave of 312 failed authentications against engineering SSO.', severity: 'medium' },
      { id: 't2', time: tsLabel(-20), type: 'mfa', title: 'MFA Challenge Flood', description: '47 MFA push notifications sent to legitimate users — push fatigue vector.', severity: 'medium' },
      { id: 't3', time: tsLabel(-18), type: 'alert', title: 'Alert Generated', description: 'Brute force pattern detected. Risk 62 / Confidence 89.', severity: 'high' },
    ],
    recommendedActions: ['Enable Adaptive Lockout', 'Block Source IPs', 'Notify SOC', 'Audit MFA Push Logs'],
  },
  {
    id: 'AEG-2026-0725-0107',
    title: 'Lateral Movement — East-West pivot to Finance DB',
    attackType: 'lateral_movement',
    severity: 'high',
    status: 'new',
    user: 'Sofia Romano',
    userId: 'u-eng-002',
    timestamp: ts(-41),
    riskScore: 84,
    confidence: 91,
    classification: 'Lateral Movement · Pass-the-Hash Suspected',
    location: 'Internal · 10.20.0.0/16',
    device: 'ENG-BUILD-07 · Ubuntu 22.04',
    description:
      'Compromised engineering account pivoted through 6 internal hosts, enumerating SMB shares and attempting WMI/RDP access to the finance database server (FIN-DB-01).',
    contributors: [
      { label: 'East-West Anomaly', weight: 30, reason: '6 internal host hops in 11 minutes — user baseline is 0 internal pivots per session.' },
      { label: 'Privileged Share Enum', weight: 22, reason: 'Enumerated 38 SMB shares including FIN-DB-01$ — outside engineering scope.' },
      { label: 'WMI/RDP Attempts', weight: 18, reason: '3 failed RDP + 2 WMI executions against FIN-DB-01 — credential reuse pattern.' },
      { label: 'New Internal Path', weight: 14, reason: 'Network path ENG-BUILD-07 → FIN-DB-01 has zero appearances in 90-day flow logs.' },
    ],
    timeline: [
      { id: 't1', time: tsLabel(-52), type: 'login', title: 'Login · Engineering', description: 'Sofia Romano authenticated to ENG-BUILD-07.', severity: 'info' },
      { id: 't2', time: tsLabel(-48), type: 'lateral_movement', title: 'SMB Enumeration', description: 'Enumerated shares on 4 internal hosts.', severity: 'medium' },
      { id: 't3', time: tsLabel(-44), type: 'lateral_movement', title: 'WMI Execution', description: 'WMI command executed on ENG-DB-02.', severity: 'high' },
      { id: 't4', time: tsLabel(-41), type: 'lateral_movement', title: 'RDP to FIN-DB-01', description: 'Failed RDP attempts against finance database server.', severity: 'high' },
      { id: 't5', time: tsLabel(-41), type: 'alert', title: 'Alert Generated', description: 'Lateral movement detected. Risk 84 / Confidence 91.', severity: 'critical' },
    ],
    recommendedActions: ['Isolate Host', 'Block Device', 'Revoke Kerberos Tickets', 'Notify SOC', 'Escalate to IR'],
  },
  {
    id: 'AEG-2026-0725-0098',
    title: 'Device Spoofing — Forged fingerprint bypasses conditional access',
    attackType: 'device_spoofing',
    severity: 'medium',
    status: 'false_positive',
    user: 'Priya Iyer',
    userId: 'u-leg-004',
    timestamp: ts(-67),
    riskScore: 48,
    confidence: 73,
    classification: 'Device Spoofing · JA3 Mismatch',
    location: 'Bengaluru, IN',
    device: 'Claimed: MacBook Air M3 · Actual: Unknown',
    description:
      'A device presented a fingerprint matching Priya Iyer\'s trusted MacBook Air, but the TLS JA3 hash and screen resolution diverged from baseline — conditional access was bypassed.',
    contributors: [
      { label: 'JA3 Mismatch', weight: 20, reason: 'JA3 hash 771…a2 differs from the trusted device\'s learned hash 771…c9.' },
      { label: 'Resolution Drift', weight: 12, reason: 'Claimed resolution 2560×1664; actual TLS-reported 1920×1080.' },
      { label: 'Trusted Fingerprint Reuse', weight: 10, reason: 'Device serial number matches a trusted asset — likely cloned.' },
      { label: 'Benign Context', weight: -8, reason: 'Analyst confirmed: new external monitor changed reported resolution. JA3 shift due to OS update.' },
    ],
    timeline: [
      { id: 't1', time: tsLabel(-70), type: 'login', title: 'Login · Bengaluru', description: 'Authentication from claimed MacBook Air M3.', severity: 'info' },
      { id: 't2', time: tsLabel(-69), type: 'unknown_device', title: 'Fingerprint Mismatch', description: 'JA3 hash diverged from trusted device baseline.', severity: 'medium' },
      { id: 't3', time: tsLabel(-67), type: 'alert', title: 'Alert Generated', description: 'Device spoofing detection. Risk 48 / Confidence 73.', severity: 'medium' },
    ],
    recommendedActions: ['Verify Device', 'Re-enroll Fingerprint', 'Notify SOC'],
  },
];

export const INITIAL_LOGS: LogEntry[] = [
  { id: 'l1', timestamp: tsLabel(-1), level: 'INFO', source: 'aegis.engine', message: 'Behavioral baseline updated for u-eng-002 (window=24h, delta=0.03)', user: 'sofia.romano', ip: '10.20.0.14' },
  { id: 'l2', timestamp: tsLabel(-2), level: 'WARN', source: 'aegis.detect', message: 'Geo-velocity check flagged session for u-hr-003', user: 'marcus.chen', ip: '203.0.113.44' },
  { id: 'l3', timestamp: tsLabel(-3), level: 'INFO', source: 'aegis.auth', message: 'SSO token issued to aarav.mehta@honeywell.com (scope=openid profile)', user: 'aarav.mehta', ip: '198.51.100.7' },
  { id: 'l4', timestamp: tsLabel(-4), level: 'CRITICAL', source: 'aegis.alert', message: 'Alert AEG-2026-0725-0138 raised · impossible_travel · risk=91', user: 'marcus.chen', ip: '203.0.113.44' },
  { id: 'l5', timestamp: tsLabel(-5), level: 'INFO', source: 'aegis.engine', message: 'Cold-start profile initialized for u-ops-005 (department=Operations)', user: 'daniel.park', ip: '10.20.0.88' },
  { id: 'l6', timestamp: tsLabel(-6), level: 'WARN', source: 'aegis.detect', message: 'Application scope drift for u-fin-001 (new app=Vendor Payments API)', user: 'aarav.mehta', ip: '198.51.100.7' },
];

export const DEPARTMENT_RISK = [
  { department: 'Finance', risk: 72, users: 42, anomalies: 3 },
  { department: 'Engineering', risk: 64, users: 128, anomalies: 5 },
  { department: 'HR', risk: 81, users: 18, anomalies: 2 },
  { department: 'Legal', risk: 38, users: 12, anomalies: 1 },
  { department: 'Operations', risk: 55, users: 64, anomalies: 4 },
];

export const THREAT_DISTRIBUTION = [
  { type: 'Credential Misuse', value: 34, color: '#3b82f6' },
  { type: 'Brute Force', value: 22, color: '#22c55e' },
  { type: 'Impossible Travel', value: 18, color: '#f97316' },
  { type: 'Lateral Movement', value: 14, color: '#a855f7' },
  { type: 'Device Spoofing', value: 12, color: '#06b6d4' },
];

export const ANALYTICS = {
  detectionAccuracy: 96.4,
  precision: 94.1,
  recall: 92.8,
  f1: 93.4,
  falsePositiveRate: 3.6,
  falseNegativeRate: 7.2,
  meanDetectionTime: 4.2,
  conceptDriftReduction: 38,
  learningProgress: 87,
  modelConfidence: 94,
  adaptiveLearningProgress: 73,
};

export const RECENT_INCIDENTS = [
  { id: 'INC-25-0142', title: 'Finance credential misuse', severity: 'high', status: 'Open', assignee: 'Preshita Nalawade', time: '4 min ago' },
  { id: 'INC-25-0138', title: 'Impossible travel — HR', severity: 'critical', status: 'Investigating', assignee: 'Preshita Nalawade', time: '9 min ago' },
  { id: 'INC-25-0129', title: 'Brute force — engineering SSO', severity: 'medium', status: 'Investigating', assignee: 'Rahul Verma', time: '18 min ago' },
  { id: 'INC-25-0107', title: 'Lateral movement to FIN-DB', severity: 'high', status: 'Open', assignee: 'Preshita Nalawade', time: '41 min ago' },
  { id: 'INC-25-0098', title: 'Device spoofing — Legal', severity: 'medium', status: 'Resolved · FP', assignee: 'Preshita Nawade', time: '67 min ago' },
];

export function severityColor(s: string): string {
  switch (s) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#22c55e';
    default: return '#3b82f6';
  }
}

export function severityBg(s: string): string {
  switch (s) {
    case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'low': return 'bg-green-500/10 text-green-400 border-green-500/30';
    default: return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
}

export function statusColor(s: string): string {
  switch (s) {
    case 'new': return 'bg-blue-500/10 text-blue-400';
    case 'investigating': return 'bg-yellow-500/10 text-yellow-400';
    case 'confirmed': return 'bg-red-500/10 text-red-400';
    case 'false_positive': return 'bg-slate-500/10 text-slate-400';
    case 'benign': return 'bg-slate-500/10 text-slate-400';
    case 'resolved': return 'bg-green-500/10 text-green-400';
    default: return 'bg-slate-500/10 text-slate-400';
  }
}
