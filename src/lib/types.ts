export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'new' | 'investigating' | 'confirmed' | 'false_positive' | 'benign' | 'resolved';
export type AttackType =
  | 'credential_misuse'
  | 'brute_force'
  | 'impossible_travel'
  | 'lateral_movement'
  | 'device_spoofing'
  | 'benign';

export interface EnterpriseUser {
  id: string;
  name: string;
  email: string;
  department: 'Finance' | 'Engineering' | 'HR' | 'Legal' | 'Operations';
  role: string;
  title: string;
  avatarColor: string;
  behaviorScore: number;
  confidence: number;
  trustedDevices: Device[];
  locations: string[];
  applications: string[];
  loginPattern: { hour: number; intensity: number }[];
  weeklyActivity: { day: string; value: number }[];
  downloadTrend: { week: string; value: number }[];
  departmentBaseline: number;
  personalBaseline: number;
  driftTrend: { day: string; value: number }[];
  coldStart: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: 'laptop' | 'desktop' | 'mobile' | 'tablet';
  os: string;
  trusted: boolean;
  lastSeen: string;
}

export interface RiskContributor {
  label: string;
  weight: number;
  reason: string;
}

export interface TimelineEvent {
  id: string;
  time: string;
  type: 'login' | 'mfa' | 'file_access' | 'unknown_device' | 'impossible_travel' | 'lateral_movement' | 'alert' | 'download';
  title: string;
  description: string;
  severity: RiskLevel;
}

export interface Alert {
  id: string;
  title: string;
  attackType: AttackType;
  severity: RiskLevel;
  status: AlertStatus;
  user: string;
  userId: string;
  timestamp: string;
  riskScore: number;
  confidence: number;
  classification: string;
  location: string;
  device: string;
  description: string;
  contributors: RiskContributor[];
  timeline: TimelineEvent[];
  recommendedActions: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  source: string;
  message: string;
  user?: string;
  ip?: string;
}

export interface Scenario {
  id: AttackType;
  name: string;
  description: string;
  expectedDetection: string;
  difficulty: 'Low' | 'Medium' | 'High';
  icon: string;
  targetUser: string;
  targetUserId: string;
}
