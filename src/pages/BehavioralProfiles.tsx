import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  Monitor, MapPin, AppWindow, Download, TrendingDown, Snowflake, Activity, Users as UsersIcon,
} from 'lucide-react';
import { USERS } from '@/lib/mockData';
import type { EnterpriseUser } from '@/lib/types';
import { Card, SectionTitle, Avatar, ProgressBar, Sparkline, fadeUp, stagger, AnimatedCounter } from '@/components/ui';

export function BehavioralProfiles() {
  const [selectedId, setSelectedId] = useState(USERS[0].id);
  const [coldStartOverride, setColdStartOverride] = useState(false);
  const user = USERS.find((u) => u.id === selectedId)!;
  const coldStart = coldStartOverride || user.coldStart;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* User list */}
      <div className="lg:col-span-3">
        <Card className="p-3 h-full">
          <div className="px-2 py-2 mb-1 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Protected Users</h3>
              <p className="text-[11px] text-slate-500">{USERS.length} behavioral profiles</p>
            </div>
            <UsersIcon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
            {USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  u.id === selectedId ? 'border-brand-500/40 bg-brand-500/10' : 'border-slate-800 hover:bg-slate-800/40'
                }`}
              >
                <Avatar name={u.name} color={u.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{u.name}</div>
                  <div className="text-[11px] text-slate-500">{u.department}</div>
                </div>
                {u.coldStart && <Snowflake className="h-3.5 w-3.5 text-blue-400" />}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Profile detail */}
      <div className="lg:col-span-9 space-y-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar name={user.name} color={user.avatarColor} size={56} />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">{user.name}</h2>
                <p className="text-xs text-slate-500">{user.title} · {user.department}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{user.email}</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-brand-400"><AnimatedCounter value={user.behaviorScore} /></div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Behavior Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-200"><AnimatedCounter value={user.confidence} suffix="%" /></div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Confidence</div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-slate-400">Cold Start</span>
                <Toggle on={coldStartOverride} onChange={() => setColdStartOverride((v) => !v)} />
              </label>
            </div>
          </Card>
        </motion.div>

        <AnimatePresence mode="wait">
          {coldStart ? (
            <motion.div key="coldstart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <Snowflake className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">No historical behavior available</h3>
                <p className="text-sm text-slate-500 mt-1">Using department baseline. Learning profile…</p>
                <div className="mt-4 max-w-sm mx-auto">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Learning progress</span><span>0%</span>
                  </div>
                  <ProgressBar value={0} color="#3b82f6" />
                  <p className="text-[11px] text-slate-600 mt-2">Profile will reach confidence after ~14 days of observed activity.</p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="profile" variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Login heatmap */}
              <motion.div variants={fadeUp}>
                <Card className="p-5 h-full">
                  <SectionTitle title="Login Heatmap" subtitle="24-hour authentication intensity" />
                  <LoginHeatmap pattern={user.loginPattern} />
                  <div className="mt-3 flex justify-between text-[10px] text-slate-600">
                    <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                  </div>
                </Card>
              </motion.div>

              {/* Weekly activity */}
              <motion.div variants={fadeUp}>
                <Card className="p-5 h-full">
                  <SectionTitle title="Weekly Activity" subtitle="Sessions per day" />
                  <div className="flex items-end gap-2 h-32 mt-2">
                    {user.weeklyActivity.map((d, i) => {
                      const max = Math.max(...user.weeklyActivity.map((x) => x.value));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <motion.div
                            className="w-full rounded-t-sm bg-brand-500/60"
                            initial={{ height: 0 }}
                            animate={{ height: `${(d.value / max) * 100}%` }}
                            transition={{ delay: i * 0.06 }}
                          />
                          <span className="text-[10px] text-slate-500">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>

              {/* Trusted devices */}
              <motion.div variants={fadeUp}>
                <Card className="p-5 h-full">
                  <SectionTitle title="Trusted Devices" subtitle="Known device fingerprints" />
                  <div className="space-y-2">
                    {user.trustedDevices.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">{d.name}</div>
                          <div className="text-[11px] text-slate-500">{d.os} · {d.lastSeen}</div>
                        </div>
                        <span className="chip bg-green-500/10 text-green-400">Trusted</span>
                      </div>
                    ))}
                    {user.trustedDevices.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">No trusted devices yet</div>}
                  </div>
                </Card>
              </motion.div>

              {/* Locations + applications */}
              <motion.div variants={fadeUp} className="space-y-6">
                <Card className="p-5">
                  <SectionTitle title="Location History" subtitle="Learned geo clusters" />
                  <div className="flex flex-wrap gap-2">
                    {user.locations.map((loc) => (
                      <span key={loc} className="chip border border-slate-700 bg-slate-800/40 text-slate-300">
                        <MapPin className="h-3 w-3" /> {loc}
                      </span>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle title="Application Usage" subtitle="Frequently accessed apps" />
                  <div className="flex flex-wrap gap-2">
                    {user.applications.map((app) => (
                      <span key={app} className="chip border border-slate-700 bg-slate-800/40 text-slate-300">
                        <AppWindow className="h-3 w-3" /> {app}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>

              {/* Download trends */}
              <motion.div variants={fadeUp}>
                <Card className="p-5 h-full">
                  <SectionTitle title="Download Trends" subtitle="Data volume over 6 weeks" />
                  <div className="flex items-end gap-2 h-32 mt-2">
                    {user.downloadTrend.map((d, i) => {
                      const max = Math.max(...user.downloadTrend.map((x) => x.value));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <motion.div
                            className="w-full rounded-t-sm bg-cyan-500/50"
                            initial={{ height: 0 }}
                            animate={{ height: `${(d.value / max) * 100}%` }}
                            transition={{ delay: i * 0.06 }}
                          />
                          <span className="text-[10px] text-slate-500">{d.week}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>

              {/* Baselines + drift */}
              <motion.div variants={fadeUp} className="md:col-span-2">
                <Card className="p-5">
                  <SectionTitle title="Behavioral Baselines & Drift" subtitle="Personal vs department baseline" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <BaselineCard label="Personal Baseline" value={user.personalBaseline} color="#3b82f6" />
                    <BaselineCard label="Department Baseline" value={user.departmentBaseline} color="#22c55e" />
                    <BaselineCard label="Current Score" value={user.behaviorScore} color={user.behaviorScore < user.personalBaseline ? '#f97316' : '#22c55e'} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-orange-400" /> Behavioral Drift Trend</span>
                      <span className="text-[11px] text-slate-500">7 days</span>
                    </div>
                    <Sparkline data={user.driftTrend.map((d) => d.value)} color="#f97316" width={600} height={48} />
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LoginHeatmap({ pattern }: { pattern: { hour: number; intensity: number }[] }) {
  return (
    <div className="grid grid-cols-24 gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
      {pattern.map((p) => (
        <motion.div
          key={p.hour}
          className="aspect-square rounded-sm"
          style={{ background: `rgba(59,130,246,${0.1 + p.intensity * 0.9})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: p.hour * 0.02 }}
          title={`${p.hour}:00 — ${Math.round(p.intensity * 100)}%`}
        />
      ))}
    </div>
  );
}

function BaselineCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <ProgressBar value={value} color={color} className="mt-2" />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-700'}`}
    >
      <motion.span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
        animate={{ left: on ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
