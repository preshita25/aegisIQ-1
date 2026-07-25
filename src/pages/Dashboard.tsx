import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Activity, AlertTriangle, Server, UserCheck, Cpu,
  TrendingUp, ArrowRight, Zap, MapPin, Radio, Brain, Eye, Gauge,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import {
  DEPARTMENT_RISK, RECENT_INCIDENTS, THREAT_DISTRIBUTION, USERS, severityBg, severityColor,
} from '@/lib/mockData';
import {
  Card, SectionTitle, AnimatedCounter, ProgressBar, Avatar, StatusDot, fadeUp, stagger,
  Sparkline, AreaLineChart, DonutChart, RadialGauge,
} from '@/components/ui';

const RISK_TREND = [
  { label: '00:00', value: 42 }, { label: '03:00', value: 38 }, { label: '06:00', value: 45 },
  { label: '09:00', value: 58 }, { label: '12:00', value: 64 }, { label: '15:00', value: 71 },
  { label: '18:00', value: 68 }, { label: '21:00', value: 62 }, { label: 'Now', value: 68 },
];
const THREAT_TREND = [
  { label: '00:00', value: 12 }, { label: '03:00', value: 8 }, { label: '06:00', value: 14 },
  { label: '09:00', value: 22 }, { label: '12:00', value: 28 }, { label: '15:00', value: 34 },
  { label: '18:00', value: 30 }, { label: '21:00', value: 24 }, { label: 'Now', value: 28 },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { alerts, logs, enterpriseRisk, behavioralHealth, protectedUsers, protectedDevices, scenarioRunning } = useApp();
  const liveAlerts = alerts.slice(0, 6);
  const driftUsers = USERS.filter((u) => Math.abs(u.behaviorScore - u.personalBaseline) > 8);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* Top metric cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={ShieldCheck}
          label="Enterprise Health"
          value={100 - enterpriseRisk}
          suffix="%"
          color="#22c55e"
          trend={[88, 90, 87, 91, 89, 92, 90]}
          trendColor="#22c55e"
          delta="+2.1%"
          deltaUp
        />
        <MetricCard
          icon={AlertTriangle}
          label="Risk Score"
          value={enterpriseRisk}
          color={enterpriseRisk >= 80 ? '#ef4444' : '#f97316'}
          trend={[55, 60, 58, 62, 65, 68, 68]}
          trendColor="#f97316"
          delta="+6 pts"
          deltaUp
        />
        <MetricCard
          icon={Cpu}
          label="Behavioral Health"
          value={behavioralHealth}
          suffix="%"
          color="#3b82f6"
          trend={[80, 84, 86, 83, 88, 86, 86]}
          trendColor="#3b82f6"
          delta="-1.4%"
        />
        <MetricCard
          icon={Activity}
          label="Active Alerts"
          value={alerts.length}
          color="#eab308"
          trend={[2, 3, 4, 3, 5, 4, 5]}
          trendColor="#eab308"
          delta="+1"
          deltaUp
        />
      </motion.div>

      {/* Row 2: Risk trend chart (2/3) + Risk gauge (1/3) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <Card className="p-5 h-full">
            <SectionTitle
              title="Risk & Threat Trend"
              subtitle="24-hour behavioral risk vs threat volume"
              action={
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2 w-2 rounded-full bg-orange-400" /> Risk Score</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="h-2 w-2 rounded-full bg-brand-400" /> Threats</span>
                </div>
              }
            />
            <AreaLineChart
              height={240}
              yMax={100}
              formatY={(v) => `${v}`}
              series={[
                { name: 'Risk Score', color: '#f97316', points: RISK_TREND },
                { name: 'Threats', color: '#3b82f6', points: THREAT_TREND },
              ]}
            />
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full flex flex-col">
            <SectionTitle title="Current Risk Posture" subtitle="Enterprise risk gauge" />
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <RadialGauge value={enterpriseRisk} size={160} thickness={12} label="Risk Score" />
              <div className="grid grid-cols-2 gap-3 w-full">
                <MiniStat icon={UserCheck} label="Protected Users" value={protectedUsers} color="#3b82f6" />
                <MiniStat icon={Server} label="Protected Devices" value={protectedDevices} color="#22c55e" />
                <MiniStat icon={MapPin} label="Monitored Geos" value={18} color="#a855f7" />
                <MiniStat icon={Radio} label="Events / sec" value={2840} color="#06b6d4" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 3: Live alerts table (2/3) + Threat distribution donut (1/3) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <Card className="p-5 h-full">
            <SectionTitle
              title="Live Alerts"
              subtitle="Behavioral detections requiring analyst attention"
              action={
                <button onClick={() => navigate('/alerts')} className="btn-ghost text-xs">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </button>
              }
            />
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="px-2 pb-2 font-medium">Alert</th>
                    <th className="px-2 pb-2 font-medium">User</th>
                    <th className="px-2 pb-2 font-medium">Severity</th>
                    <th className="px-2 pb-2 font-medium">Risk</th>
                    <th className="px-2 pb-2 font-medium">Status</th>
                    <th className="px-2 pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {liveAlerts.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/alerts?id=${a.id}`)}
                      className="border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: severityColor(a.severity) }} />
                          <span className="text-slate-200 line-clamp-1 text-[13px]">{a.title}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[12px] text-slate-400 whitespace-nowrap">{a.user}</td>
                      <td className="px-2 py-2.5"><span className={`chip border ${severityBg(a.severity)}`}>{a.severity}</span></td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-12"><ProgressBar value={a.riskScore} color={severityColor(a.severity)} /></div>
                          <span className="text-[11px] text-slate-400">{a.riskScore}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[11px] text-slate-400 capitalize whitespace-nowrap">{a.status.replace('_', ' ')}</td>
                      <td className="px-2 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{a.timestamp.slice(11, 16)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Threat Distribution" subtitle="Attack classification · 7 days" />
            <div className="mt-2">
              <DonutChart
                data={THREAT_DISTRIBUTION.map((t) => ({ label: t.type, value: t.value, color: t.color }))}
                size={150}
                thickness={16}
                centerValue="100%"
                centerLabel="Classified"
              />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 4: Real-time log stream (2/3) + Behavioral drift (1/3) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <Card className="p-5 h-full">
            <SectionTitle
              title="Real-Time Log Stream"
              subtitle="Behavioral engine telemetry"
              action={
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <StatusDot color={scenarioRunning ? '#f97316' : '#22c55e'} pulse />
                  {scenarioRunning ? 'Streaming' : 'Live'}
                </span>
              }
            />
            <div className="h-64 overflow-y-auto scrollbar-thin font-mono text-[11px] space-y-0.5">
              {logs.map((l) => (
                <div key={l.id} className="flex gap-2 rounded px-2 py-1 hover:bg-slate-800/40">
                  <span className="text-slate-600 shrink-0">{l.timestamp}</span>
                  <span
                    className="shrink-0 font-semibold w-16"
                    style={{ color: l.level === 'CRITICAL' ? '#ef4444' : l.level === 'ERROR' ? '#f97316' : l.level === 'WARN' ? '#eab308' : '#64748b' }}
                  >
                    {l.level}
                  </span>
                  <span className="text-slate-500 shrink-0">{l.source}</span>
                  <span className="text-slate-300 truncate">{l.message}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Behavioral Drift Summary" subtitle="Users deviating from baseline" />
            <div className="space-y-2">
              {driftUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <Avatar name={u.name} color={u.avatarColor} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-slate-200">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.department} · drift {u.behaviorScore - u.personalBaseline > 0 ? '+' : ''}{u.behaviorScore - u.personalBaseline}</div>
                  </div>
                  <Sparkline data={u.driftTrend.map((d) => d.value)} color="#f97316" width={56} height={22} />
                </div>
              ))}
              {driftUsers.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">No significant drift detected</div>}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 5: Recent incidents + Department risk + Quick actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Recent Incidents" subtitle="Investigation queue" />
            <div className="space-y-2">
              {RECENT_INCIDENTS.map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 hover:bg-slate-800/40 transition-colors">
                  <span className={`chip border ${severityBg(inc.severity)} shrink-0`}>{inc.severity}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-slate-200">{inc.title}</div>
                    <div className="text-[10px] text-slate-500">{inc.id} · {inc.assignee}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{inc.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Department Risk" subtitle="Risk by business unit" />
            <div className="space-y-3 mt-1">
              {DEPARTMENT_RISK.map((d) => (
                <div key={d.department} className="flex items-center gap-3">
                  <div className="w-20 text-[13px] text-slate-300">{d.department}</div>
                  <div className="flex-1"><ProgressBar value={d.risk} color={d.risk >= 75 ? '#ef4444' : d.risk >= 55 ? '#f97316' : '#22c55e'} /></div>
                  <div className="w-8 text-right text-[12px] text-slate-400">{d.risk}</div>
                  <div className="hidden sm:block w-20 text-right text-[10px] text-slate-500">{d.anomalies} anom</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="lg:col-span-2 xl:col-span-1">
          <Card className="p-5 h-full">
            <SectionTitle title="Quick Actions" subtitle="Analyst shortcuts" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate('/scenarios')} className="btn-primary col-span-2">
                <Zap className="h-4 w-4" /> Launch Scenario
              </button>
              <button onClick={() => navigate('/alerts')} className="btn-outline">
                <ShieldAlert className="h-4 w-4" /> Investigate
              </button>
              <button onClick={() => navigate('/profiles')} className="btn-outline">
                <UserCheck className="h-4 w-4" /> Profiles
              </button>
              <button onClick={() => navigate('/analytics')} className="btn-outline">
                <TrendingUp className="h-4 w-4" /> Analytics
              </button>
              <button onClick={() => navigate('/settings')} className="btn-outline">
                <Gauge className="h-4 w-4" /> Configure
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-brand-500/20 bg-brand-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-[11px] font-medium text-brand-300">Adaptive Learning</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">Model retrained 2h ago with 47 analyst verdicts. Concept drift reduced by 38%.</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MetricCard({
  icon: Icon, label, value, suffix = '', color, trend, trendColor, delta, deltaUp,
}: {
  icon: typeof ShieldCheck; label: string; value: number; suffix?: string; color: string;
  trend: number[]; trendColor: string; delta?: string; deltaUp?: boolean;
}) {
  return (
    <Card hover className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <Sparkline data={trend} color={trendColor} width={72} height={28} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-white">
            <AnimatedCounter value={value} suffix={suffix} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        </div>
        {delta && (
          <span className={`text-[11px] font-medium ${deltaUp ? 'text-orange-400' : 'text-green-400'}`}>{delta}</span>
        )}
      </div>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: typeof ShieldCheck; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-base font-semibold text-white">
        <AnimatedCounter value={value} />
      </div>
    </div>
  );
}
