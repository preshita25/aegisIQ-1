import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound, Hammer, Plane, Network, Smartphone, Zap, Loader2, CheckCircle2, Activity,
} from 'lucide-react';
import { SCENARIOS } from '@/lib/mockData';
import { useApp } from '@/lib/store';
import { Card, SectionTitle, fadeUp, stagger, StatusDot } from '@/components/ui';
import type { AttackType } from '@/lib/types';

const ICONS: Record<string, typeof KeyRound> = {
  KeyRound, Hammer, Plane, Network, Smartphone,
};

const DIFFICULTY_COLOR: Record<string, string> = {
  Low: 'bg-green-500/10 text-green-400 border-green-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  High: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export function ScenarioStudio() {
  const navigate = useNavigate();
  const { launchScenario, activeScenario, scenarioRunning, logs } = useApp();

  const handleLaunch = (id: AttackType) => {
    launchScenario(id);
  };

  const streamLogs = logs.filter((l) => l.source.startsWith('aegis.')).slice(0, 8);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/30">
              <Zap className="h-6 w-6 text-brand-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white">Scenario Studio</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate every Honeywell attack vector. Launching a scenario streams synthetic logs, raises an alert, increases risk, and updates the entire application in real time.
              </p>
            </div>
            {scenarioRunning && (
              <span className="chip bg-brand-500/15 text-brand-300 border border-brand-500/30">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Streaming…
              </span>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SCENARIOS.map((s) => {
          const Icon = ICONS[s.icon] ?? Zap;
          const isActive = activeScenario === s.id;
          return (
            <motion.div key={s.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <Card hover className={`p-5 h-full flex flex-col ${isActive ? 'border-brand-500/40 bg-brand-500/5' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/60">
                    <Icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <span className={`chip border ${DIFFICULTY_COLOR[s.difficulty]}`}>{s.difficulty}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{s.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed flex-1">{s.description}</p>
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-0.5">Expected Detection</div>
                  <div className="text-[11px] text-slate-300">{s.expectedDetection}</div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">Target: <span className="text-slate-300">{s.targetUser}</span></div>
                <button
                  onClick={() => handleLaunch(s.id)}
                  disabled={scenarioRunning}
                  className={`mt-3 ${isActive ? 'btn-primary' : 'btn-outline'} w-full`}
                >
                  {isActive && scenarioRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Streaming…</>
                  ) : isActive ? (
                    <><CheckCircle2 className="h-4 w-4" /> Launched — View Alert</>
                  ) : (
                    <><Zap className="h-4 w-4" /> Launch Scenario</>
                  )}
                </button>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Live stream */}
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <SectionTitle
            title="Synthetic Log Stream"
            subtitle="Generated telemetry from active scenario"
            action={
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <StatusDot color={scenarioRunning ? '#f97316' : '#22c55e'} pulse />
                {scenarioRunning ? 'Streaming' : 'Idle'}
              </span>
            }
          />
          <div className="h-56 overflow-y-auto scrollbar-thin font-mono text-[11px] space-y-1">
            <AnimatePresence initial={false}>
              {streamLogs.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 rounded px-2 py-1 hover:bg-slate-800/40"
                >
                  <span className="text-slate-600 shrink-0">{l.timestamp}</span>
                  <span className="shrink-0 font-semibold" style={{ color: l.level === 'CRITICAL' ? '#ef4444' : l.level === 'WARN' ? '#eab308' : '#64748b' }}>
                    {l.level.padEnd(8)}
                  </span>
                  <span className="text-slate-500 shrink-0">{l.source}</span>
                  <span className="text-slate-300 truncate">{l.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {!scenarioRunning && streamLogs.length === 0 && (
              <div className="flex items-center justify-center h-full text-xs text-slate-600">
                <Activity className="h-4 w-4 mr-2" /> Launch a scenario to generate streaming logs
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {activeScenario && (
        <motion.div variants={fadeUp}>
          <Card className="p-5 border-brand-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Scenario Impact</h3>
                <p className="text-xs text-slate-500 mt-0.5">The entire application has been updated — dashboard risk, alert queue, timeline, and analytics reflect this simulation.</p>
              </div>
              <button onClick={() => navigate('/alerts')} className="btn-primary">
                Go to Alert Investigation
              </button>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
