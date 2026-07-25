import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Alert, AlertStatus, LogEntry } from './types';
import { INITIAL_ALERTS, INITIAL_LOGS, SCENARIOS, getUser } from './mockData';

interface AppState {
  alerts: Alert[];
  logs: LogEntry[];
  enterpriseRisk: number;
  behavioralHealth: number;
  protectedUsers: number;
  protectedDevices: number;
  activeScenario: string | null;
  scenarioRunning: boolean;
  feedbackGiven: Record<string, AlertStatus>;
  coldStart: boolean;
  launchScenario: (id: string) => void;
  stopScenario: () => void;
  giveFeedback: (alertId: string, status: AlertStatus) => void;
  appendLog: (entry: Omit<LogEntry, 'id'>) => void;
}

const AppContext = createContext<AppState | null>(null);

let logCounter = 100;
function nowLabel() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

const SCENARIO_LOG_TEMPLATES: Record<string, { level: LogEntry['level']; source: string; message: (u: string, ip: string) => string }[]> = {
  credential_misuse: [
    { level: 'INFO', source: 'aegis.auth', message: (u) => `SSO authentication for ${u}@honeywell.com from new device` },
    { level: 'WARN', source: 'aegis.detect', message: (u) => `Untrusted device fingerprint for ${u} — adding to risk contributors` },
    { level: 'WARN', source: 'aegis.detect', message: (u) => `Geo anomaly: login outside learned cluster for ${u}` },
    { level: 'WARN', source: 'aegis.detect', message: (u) => `Application scope drift: ${u} accessed Vendor Payments API` },
    { level: 'CRITICAL', source: 'aegis.alert', message: (u) => `Alert raised · credential_misuse · user=${u} · risk=78` },
  ],
  brute_force: [
    { level: 'WARN', source: 'aegis.auth', message: () => `Failed auth burst: 312 failures in 60s against engineering SSO` },
    { level: 'WARN', source: 'aegis.detect', message: () => `IP rotation detected: 87 distinct sources in 240s` },
    { level: 'WARN', source: 'aegis.detect', message: () => `MFA push fatigue vector: 47 pushes in 90s` },
    { level: 'CRITICAL', source: 'aegis.alert', message: () => `Alert raised · brute_force · risk=62` },
  ],
  impossible_travel: [
    { level: 'INFO', source: 'aegis.auth', message: (u) => `Login from Bengaluru for ${u}` },
    { level: 'CRITICAL', source: 'aegis.detect', message: (u) => `Impossible travel: ${u} authenticated in London 23 min later` },
    { level: 'CRITICAL', source: 'aegis.alert', message: (u) => `Alert raised · impossible_travel · user=${u} · risk=91` },
  ],
  lateral_movement: [
    { level: 'INFO', source: 'aegis.auth', message: (u) => `Session established for ${u} on ENG-BUILD-07` },
    { level: 'WARN', source: 'aegis.detect', message: () => `SMB enumeration on 4 internal hosts` },
    { level: 'WARN', source: 'aegis.detect', message: () => `WMI execution on ENG-DB-02` },
    { level: 'CRITICAL', source: 'aegis.detect', message: () => `RDP attempts against FIN-DB-01 — east-west pivot` },
    { level: 'CRITICAL', source: 'aegis.alert', message: (u) => `Alert raised · lateral_movement · user=${u} · risk=84` },
  ],
  device_spoofing: [
    { level: 'WARN', source: 'aegis.detect', message: (u) => `Device fingerprint claimed by ${u} matches trusted asset` },
    { level: 'WARN', source: 'aegis.detect', message: () => `JA3 hash mismatch — TLS fingerprint diverges from baseline` },
    { level: 'WARN', source: 'aegis.detect', message: () => `Screen resolution drift: 2560×1664 → 1920×1080` },
    { level: 'CRITICAL', source: 'aegis.alert', message: (u) => `Alert raised · device_spoofing · user=${u} · risk=48` },
  ],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [enterpriseRisk, setEnterpriseRisk] = useState(68);
  const [behavioralHealth, setBehavioralHealth] = useState(86);
  const [protectedUsers] = useState(264);
  const [protectedDevices] = useState(1840);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, AlertStatus>>({});
  const [coldStart, setColdStart] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLogs((prev) => [{ ...entry, id: `l${logCounter++}` }, ...prev].slice(0, 60));
  }, []);

  const launchScenario = useCallback((id: string) => {
    clearTimers();
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    setActiveScenario(id);
    setScenarioRunning(true);
    setColdStart(false);

    const user = getUser(scenario.targetUserId);
    const username = user?.email.split('@')[0] ?? 'unknown';
    const ip = '198.51.100.' + Math.floor(Math.random() * 254);

    const templates = SCENARIO_LOG_TEMPLATES[id] ?? [];
    templates.forEach((t, i) => {
      const timer = window.setTimeout(() => {
        appendLog({
          timestamp: nowLabel(),
          level: t.level,
          source: t.source,
          message: t.message(username, ip),
          user: username,
          ip,
        });
      }, (i + 1) * 900);
      timers.current.push(timer);
    });

    const alertTimer = window.setTimeout(() => {
      const newAlert: Alert = {
        id: `AEG-2026-0725-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        title: `${scenario.name} — simulated by Scenario Studio`,
        attackType: id as Alert['attackType'],
        severity: scenario.difficulty === 'High' ? 'critical' : scenario.difficulty === 'Medium' ? 'high' : 'medium',
        status: 'new',
        user: scenario.targetUser,
        userId: scenario.targetUserId,
        timestamp: new Date().toISOString(),
        riskScore: scenario.difficulty === 'High' ? 88 : scenario.difficulty === 'Medium' ? 74 : 58,
        confidence: 90 + Math.floor(Math.random() * 8),
        classification: `${scenario.name} · Simulated`,
        location: 'Scenario Studio',
        device: 'Simulated',
        description: scenario.description,
        contributors: [
          { label: 'Scenario Injection', weight: 30, reason: 'Behavioral pattern injected by Scenario Studio for detection validation.' },
          { label: 'Baseline Deviation', weight: 22, reason: 'Observed behavior diverged from the learned 90-day baseline.' },
          { label: 'Engine Confidence', weight: 18, reason: 'Detection model classified this pattern with high confidence.' },
        ],
        timeline: [
          { id: 's1', time: nowLabel(), type: 'login', title: 'Simulated Login', description: 'Scenario injected authentication event.', severity: 'info' },
          { id: 's2', time: nowLabel(), type: 'alert', title: 'Alert Generated', description: `${scenario.name} detected by behavioral engine.`, severity: 'critical' },
        ],
        recommendedActions: ['Lock Account', 'Block Device', 'Notify SOC', 'Escalate'],
      };
      setAlerts((prev) => [newAlert, ...prev]);
      setEnterpriseRisk((r) => Math.min(99, r + 8));
      setBehavioralHealth((h) => Math.max(40, h - 6));
    }, (templates.length + 1) * 900);
    timers.current.push(alertTimer);

    const stopTimer = window.setTimeout(() => setScenarioRunning(false), (templates.length + 2) * 900);
    timers.current.push(stopTimer);
  }, [appendLog]);

  const stopScenario = useCallback(() => {
    clearTimers();
    setActiveScenario(null);
    setScenarioRunning(false);
  }, []);

  const giveFeedback = useCallback((alertId: string, status: AlertStatus) => {
    setFeedbackGiven((prev) => ({ ...prev, [alertId]: status }));
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status } : a)));
    appendLog({
      timestamp: nowLabel(),
      level: 'INFO',
      source: 'aegis.learn',
      message: `Adaptive learning updated · analyst feedback=${status} · alert=${alertId}`,
    });
    setBehavioralHealth((h) => Math.min(99, h + 2));
  }, [appendLog]);

  return (
    <AppContext.Provider
      value={{
        alerts, logs, enterpriseRisk, behavioralHealth, protectedUsers, protectedDevices,
        activeScenario, scenarioRunning, feedbackGiven, coldStart,
        launchScenario, stopScenario, giveFeedback, appendLog,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
