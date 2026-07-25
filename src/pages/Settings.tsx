import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  User, Bell, Plug, Palette, Lock, Cpu, Activity, Check, Sliders,
} from 'lucide-react';
import { ANALYST } from '@/lib/mockData';
import { Card, SectionTitle, Avatar, ProgressBar, StatusDot, fadeUp, stagger } from '@/components/ui';

export function Settings() {
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSlack, setNotifSlack] = useState(true);
  const [notifCritical, setNotifCritical] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'midnight' | 'slate'>('dark');
  const [sensitivity, setSensitivity] = useState(72);
  const [learningRate, setLearningRate] = useState(0.14);
  const [coldStartDays, setColdStartDays] = useState(14);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      {/* SOC profile */}
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <SectionTitle title="SOC Profile" subtitle="Analyst identity" />
          <div className="flex items-center gap-4">
            <Avatar name={ANALYST.name} color={ANALYST.avatarColor} size={56} />
            <div className="flex-1">
              <div className="text-base font-semibold text-white">{ANALYST.name}</div>
              <div className="text-xs text-slate-500">{ANALYST.role} · {ANALYST.team}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{ANALYST.email}</div>
            </div>
            <button className="btn-outline text-xs">Edit Profile</button>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Tier" value="Tier 2" />
            <StatTile label="Region" value="APAC" />
            <StatTile label="Shift" value="09:00–18:00 IST" />
            <StatTile label="Cases (30d)" value="47" />
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Notifications" subtitle="Alert delivery channels" />
            <div className="space-y-3">
              <ToggleRow icon={Bell} label="Email notifications" desc="Daily digest + critical alerts" on={notifEmail} onChange={() => setNotifEmail((v) => !v)} />
              <ToggleRow icon={Plug} label="Slack integration" desc="#soc-alerts channel" on={notifSlack} onChange={() => setNotifSlack((v) => !v)} />
              <ToggleRow icon={Activity} label="Critical-only mode" desc="Suppress low/medium outside shift" on={notifCritical} onChange={() => setNotifCritical((v) => !v)} />
            </div>
          </Card>
        </motion.div>

        {/* API integrations */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="API Integrations" subtitle="Connected data sources" />
            <div className="space-y-2.5">
              {[
                { name: 'Azure AD SSO', status: 'Connected', color: '#22c55e' },
                { name: 'Splunk SIEM', status: 'Connected', color: '#22c55e' },
                { name: 'CrowdStrike Falcon', status: 'Connected', color: '#22c55e' },
                { name: 'ServiceNow ITSM', status: 'Connected', color: '#22c55e' },
                { name: ' Palo Alto Cortex', status: 'Not configured', color: '#64748b' },
              ].map((api) => (
                <div key={api.name} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                  <Plug className="h-4 w-4 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-200">{api.name.trim()}</div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: api.color }}>
                    <StatusDot color={api.color} /> {api.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Theme */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Theme" subtitle="Appearance" />
            <div className="grid grid-cols-3 gap-3">
              {(['dark', 'midnight', 'slate'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`rounded-lg border p-3 text-left transition-colors ${theme === t ? 'border-brand-500/50 bg-brand-500/10' : 'border-slate-800 hover:bg-slate-800/40'}`}
                >
                  <div className="h-12 rounded-md mb-2" style={{ background: t === 'dark' ? '#0b1120' : t === 'midnight' ? '#020617' : '#1e293b' }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs capitalize text-slate-300">{t}</span>
                    {theme === t && <Check className="h-3.5 w-3.5 text-brand-400" />}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Access control */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Access Control" subtitle="Role-based permissions" />
            <div className="space-y-2.5">
              {[
                { role: 'View Dashboard', granted: true },
                { role: 'Investigate Alerts', granted: true },
                { role: 'Launch Scenarios', granted: true },
                { role: 'Modify Engine Config', granted: false },
                { role: 'Manage Users', granted: false },
              ].map((p) => (
                <div key={p.role} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-200">{p.role}</span>
                  </div>
                  <span className={`chip ${p.granted ? 'bg-green-500/10 text-green-400' : 'bg-slate-700/40 text-slate-500'}`}>
                    {p.granted ? 'Granted' : 'Restricted'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Behavioral engine config */}
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <SectionTitle title="Behavioral Engine Configuration" subtitle="Tune detection sensitivity and learning" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Slider label="Detection Sensitivity" value={sensitivity} onChange={setSensitivity} min={0} max={100} suffix="" />
            <Slider label="Learning Rate" value={learningRate * 100} onChange={(v) => setLearningRate(v / 100)} min={1} max={50} suffix="%" decimals={0} />
            <Slider label="Cold Start Window" value={coldStartDays} onChange={setColdStartDays} min={3} max={30} suffix=" days" />
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <EngineStat icon={Cpu} label="Model Version" value="aegis-behavioral-v3.2" />
            <EngineStat icon={Activity} label="Profiles Learned" value="264 / 264" />
            <EngineStat icon={Sliders} label="Last Retrain" value="2 hours ago" />
          </div>
        </Card>
      </motion.div>

      {/* System status */}
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <SectionTitle title="System Status" subtitle="Platform health" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatusTile label="Behavioral Engine" status="Operational" color="#22c55e" pct={99.9} />
            <StatusTile label="Log Ingestion" status="Operational" color="#22c55e" pct={99.8} />
            <StatusTile label="Alert Pipeline" status="Degraded" color="#eab308" pct={97.2} />
            <StatusTile label="Adaptive Learning" status="Operational" color="#22c55e" pct={100} />
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ToggleRow({ icon: Icon, label, desc, on, onChange }: { icon: typeof Bell; label: string; desc: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="flex-1">
        <div className="text-sm text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500">{desc}</div>
      </div>
      <button onClick={onChange} className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-700'}`}>
        <motion.span className="absolute top-0.5 h-4 w-4 rounded-full bg-white" animate={{ left: on ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, suffix, decimals = 0 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix: string; decimals?: number }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-medium text-slate-200">{value.toFixed(decimals)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}

function EngineStat({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function StatusTile({ label, status, color, pct }: { label: string; status: string; color: string; pct: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <StatusDot color={color} pulse={status === 'Operational'} />
        <span className="text-sm font-medium text-slate-200">{label}</span>
      </div>
      <div className="text-xs mb-2" style={{ color }}>{status}</div>
      <ProgressBar value={pct} color={color} />
      <div className="mt-1 text-[10px] text-slate-500">{pct}% uptime</div>
    </div>
  );
}
