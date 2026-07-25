import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ShieldAlert, Lock, KeyRound, Ban, Bell, ArrowUpCircle, CheckCircle2, XCircle, CircleDot,
  Monitor, MapPin, Clock, AppWindow, Download, LogIn, ShieldCheck, Plane, Network, Smartphone, FileText, Fingerprint,
  TrendingUp, Lightbulb, GraduationCap,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { getUser } from '@/lib/mockData';
import type { Alert, AlertStatus, TimelineEvent } from '@/lib/types';
import { Card, SectionTitle, RiskGauge, Avatar, AnimatedCounter, ProgressBar, fadeUp, stagger, StatusDot } from '@/components/ui';

const TIMELINE_ICONS: Record<string, typeof LogIn> = {
  login: LogIn, mfa: ShieldCheck, file_access: FileText, unknown_device: Monitor,
  impossible_travel: Plane, lateral_movement: Network, alert: ShieldAlert, download: Download,
};

export function AlertInvestigation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { alerts, giveFeedback, feedbackGiven } = useApp();
  const selectedId = params.get('id') ?? alerts[0]?.id;
  const alert = alerts.find((a) => a.id === selectedId) ?? alerts[0];

  if (!alert) return <div className="text-slate-500">No alerts.</div>;

  const user = getUser(alert.userId);
  const feedback = feedbackGiven[alert.id];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Alert list */}
      <div className="lg:col-span-3">
        <Card className="p-3 h-full">
          <div className="px-2 py-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">Alert Queue</h3>
            <p className="text-[11px] text-slate-500">{alerts.length} active detections</p>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
            {alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/alerts?id=${a.id}`)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  a.id === alert.id ? 'border-brand-500/40 bg-brand-500/10' : 'border-slate-800 bg-slate-900/30 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: severityColorFor(a.severity) }} />
                  <span className="text-[10px] font-mono text-slate-500 truncate">{a.id}</span>
                </div>
                <div className="text-xs text-slate-200 line-clamp-2">{a.title}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{a.user}</span>
                  <span className="text-[10px] text-slate-500">risk {a.riskScore}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Middle: Timeline */}
      <div className="lg:col-span-5 space-y-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`chip border ${severityBgFor(alert.severity)}`}>{alert.severity}</span>
                  <span className="text-[11px] font-mono text-slate-500">{alert.id}</span>
                </div>
                <h2 className="text-base font-semibold text-white leading-snug">{alert.title}</h2>
                <p className="text-xs text-slate-500 mt-1">{alert.classification}</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{alert.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <Field icon={MapPin} label="Location" value={alert.location} />
              <Field icon={Monitor} label="Device" value={alert.device} />
              <Field icon={Clock} label="Detected" value={new Date(alert.timestamp).toLocaleString()} />
              <Field icon={ShieldAlert} label="Status" value={alert.status.replace('_', ' ')} />
            </div>
          </Card>
        </motion.div>

        <Card className="p-5">
          <SectionTitle title="Investigation Timeline" subtitle="Chronological behavioral events" />
          <div className="relative pl-6">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-800" />
            <div className="space-y-4">
              {alert.timeline.map((ev, i) => (
                <TimelineRow key={ev.id} event={ev} index={i} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Right: Profile + Risk + Actions + Feedback */}
      <div className="lg:col-span-4 space-y-6">
        {user && (
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card className="p-5">
              <SectionTitle title="Behavioral Profile" subtitle="Learned identity context" />
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={user.name} color={user.avatarColor} size={44} />
                <div>
                  <div className="text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-[11px] text-slate-500">{user.title}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold text-brand-400">{user.confidence}%</div>
                  <div className="text-[10px] text-slate-500">Confidence</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <ProfileField icon={AppWindow} label="Department" value={user.department} />
                <ProfileField icon={ShieldCheck} label="Role" value={user.role} />
                <ProfileField icon={Monitor} label="Trusted Devices" value={`${user.trustedDevices.length}`} />
                <ProfileField icon={MapPin} label="Locations" value={`${user.locations.length}`} />
                <ProfileField icon={AppWindow} label="Applications" value={`${user.applications.length}`} />
                <ProfileField icon={Download} label="Behavior Score" value={`${user.behaviorScore}`} />
              </div>
              {user.coldStart && (
                <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-300">
                  Cold Start · No historical behavior. Using department baseline. Learning profile…
                </div>
              )}
            </Card>
          </motion.div>
        )}

        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <SectionTitle title="Risk Analysis" subtitle="Explainable risk contributors" />
            <div className="flex items-center gap-4 mb-4">
              <RiskGauge value={alert.riskScore} size={100} label="Risk" />
              <div className="flex-1 space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1"><span>Confidence</span><span>{alert.confidence}%</span></div>
                  <ProgressBar value={alert.confidence} color="#3b82f6" />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1"><span>Behavior Score</span><span>{user?.behaviorScore ?? 0}</span></div>
                  <ProgressBar value={user?.behaviorScore ?? 0} color="#22c55e" />
                </div>
              </div>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Risk Contributors</div>
            <div className="space-y-2.5">
              {alert.contributors.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                      <span className="text-xs font-medium text-slate-200">{c.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-400">+{c.weight}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{c.reason}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <SectionTitle title="Recommended Actions" subtitle="Analyst response playbook" />
            <div className="grid grid-cols-2 gap-2">
              {alert.recommendedActions.map((action) => {
                const icon = actionIcon(action);
                return (
                  <button key={action} className="btn-outline justify-start text-xs">
                    {icon}
                    {action}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="p-5">
            <SectionTitle title="Analyst Feedback" subtitle="Adaptive learning loop" />
            <div className="grid grid-cols-3 gap-2">
              <FeedbackButton active={feedback === 'confirmed'} onClick={() => giveFeedback(alert.id, 'confirmed')} icon={XCircle} label="Confirmed Attack" color="#ef4444" />
              <FeedbackButton active={feedback === 'false_positive'} onClick={() => giveFeedback(alert.id, 'false_positive')} icon={CheckCircle2} label="False Positive" color="#22c55e" />
              <FeedbackButton active={feedback === 'benign'} onClick={() => giveFeedback(alert.id, 'benign')} icon={CircleDot} label="Benign" color="#64748b" />
            </div>
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                    <GraduationCap className="h-4 w-4" />
                    Adaptive Learning Updated · model retrained with analyst verdict
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function TimelineRow({ event, index }: { event: TimelineEvent; index: number }) {
  const Icon = TIMELINE_ICONS[event.type] ?? LogIn;
  const color = severityColorFor(event.severity);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      <div className="absolute -left-[18px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950" style={{ background: `${color}25` }}>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <div className="ml-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-200">{event.title}</span>
          <span className="text-[10px] font-mono text-slate-500">{event.time}</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{event.description}</p>
      </div>
    </motion.div>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div>
        <div className="text-slate-300 capitalize">{value}</div>
      </div>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-slate-200 text-xs">{value}</div>
    </div>
  );
}

function FeedbackButton({ active, onClick, icon: Icon, label, color }: { active: boolean; onClick: () => void; icon: typeof XCircle; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-[11px] font-medium transition-all ${
        active ? 'border-current' : 'border-slate-800 hover:border-slate-700'
      }`}
      style={active ? { color, background: `${color}1a` } : { color: '#94a3b8' }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function actionIcon(action: string) {
  const map: Record<string, typeof Lock> = {
    'Lock Account': Lock, 'Reset Password': KeyRound, 'Block Device': Ban,
    'Notify SOC': Bell, 'Escalate': ArrowUpCircle, 'Escalate to Tier 3': ArrowUpCircle,
    'Escalate to IR': ArrowUpCircle, 'Revoke Sessions': ShieldCheck, 'Isolate Host': Ban,
    'Revoke Kerberos Tickets': KeyRound, 'Enable Adaptive Lockout': ShieldCheck,
    'Block Source IPs': Ban, 'Audit MFA Push Logs': FileText, 'Verify Device': Fingerprint,
    'Re-enroll Fingerprint': Fingerprint,
  };
  const Icon = map[action] ?? Lightbulb;
  return <Icon className="h-3.5 w-3.5" />;
}

function severityColorFor(s: string): string {
  return s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#eab308' : s === 'low' ? '#22c55e' : '#3b82f6';
}
function severityBgFor(s: string): string {
  return s === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/30'
    : s === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
    : s === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    : s === 'low' ? 'bg-green-500/10 text-green-400 border-green-500/30'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/30';
}
