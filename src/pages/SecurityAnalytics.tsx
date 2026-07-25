import { motion } from 'framer-motion';
import {
  Target, Crosshair, GitMerge, AlertCircle, XCircle, Clock, TrendingDown, Brain, Gauge,
} from 'lucide-react';
import { ANALYTICS, DEPARTMENT_RISK, THREAT_DISTRIBUTION, USERS } from '@/lib/mockData';
import { Card, SectionTitle, AnimatedCounter, ProgressBar, fadeUp, stagger, Sparkline } from '@/components/ui';

export function SecurityAnalytics() {
  const detectionTrend = [88, 90, 91, 93, 94, 95, 96.4];
  const driftTrend = [62, 58, 55, 50, 46, 42, 38];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* KPI row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Target} label="Detection Accuracy" value={ANALYTICS.detectionAccuracy} suffix="%" color="#22c55e" trend={detectionTrend} />
        <MetricCard icon={Crosshair} label="Precision" value={ANALYTICS.precision} suffix="%" color="#3b82f6" trend={[88, 90, 91, 92, 93, 94, 94.1]} />
        <MetricCard icon={GitMerge} label="F1 Score" value={ANALYTICS.f1} suffix="" color="#a855f7" trend={[85, 87, 89, 90, 91, 92, 93.4]} />
        <MetricCard icon={Clock} label="Mean Detection Time" value={ANALYTICS.meanDetectionTime} suffix="s" color="#06b6d4" trend={[8, 7, 6.5, 5.8, 5, 4.5, 4.2]} invert />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={AlertCircle} label="False Positive Rate" value={ANALYTICS.falsePositiveRate} suffix="%" color="#f97316" trend={[8, 7, 6, 5, 4.5, 4, 3.6]} invert />
        <MetricCard icon={XCircle} label="False Negative Rate" value={ANALYTICS.falseNegativeRate} suffix="%" color="#ef4444" trend={[12, 11, 10, 9, 8.5, 8, 7.2]} invert />
        <MetricCard icon={Brain} label="Model Confidence" value={ANALYTICS.modelConfidence} suffix="%" color="#22c55e" trend={[85, 88, 90, 91, 92, 93, 94]} />
        <MetricCard icon={Gauge} label="Recall" value={ANALYTICS.recall} suffix="%" color="#3b82f6" trend={[85, 87, 89, 90, 91, 92, 92.8]} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Adaptive learning */}
        <motion.div variants={fadeUp} className="xl:col-span-2">
          <Card className="p-5 h-full">
            <SectionTitle title="Adaptive Learning Progress" subtitle="Model retraining from analyst feedback" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <ProgressTile label="Learning Progress" value={ANALYTICS.learningProgress} color="#3b82f6" />
              <ProgressTile label="Adaptive Learning" value={ANALYTICS.adaptiveLearningProgress} color="#22c55e" />
              <ProgressTile label="Concept Drift Reduction" value={ANALYTICS.conceptDriftReduction} color="#f97316" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-orange-400" /> Concept Drift Reduction (7 days)</span>
                <span className="text-[11px] text-slate-500">↓ {ANALYTICS.conceptDriftReduction}%</span>
              </div>
              <Sparkline data={driftTrend} color="#f97316" width={600} height={56} />
            </div>
          </Card>
        </motion.div>

        {/* Threat distribution donut */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Threat Distribution" subtitle="Attack classification breakdown" />
            <DonutChart data={THREAT_DISTRIBUTION} />
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Department risk heatmap */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Department Risk Heatmap" subtitle="Risk × anomaly density" />
            <div className="space-y-3 mt-2">
              {DEPARTMENT_RISK.map((d) => (
                <div key={d.department} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-slate-300">{d.department}</div>
                  <div className="flex-1 flex gap-1">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const threshold = (d.risk / 100) * 20;
                      const active = i < threshold;
                      const intensity = active ? d.risk / 100 : 0.05;
                      return (
                        <motion.div
                          key={i}
                          className="h-5 flex-1 rounded-sm"
                          style={{ background: active ? `rgba(239,68,68,${0.2 + intensity * 0.7})` : 'rgba(30,41,59,0.4)' }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                        />
                      );
                    })}
                  </div>
                  <div className="w-10 text-right text-sm text-slate-400">{d.risk}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-600">
              <span>Low risk</span><span>High risk</span>
            </div>
          </Card>
        </motion.div>

        {/* Behavioral drift by user */}
        <motion.div variants={fadeUp}>
          <Card className="p-5 h-full">
            <SectionTitle title="Behavioral Drift by User" subtitle="Drift trend across protected identities" />
            <div className="space-y-3">
              {USERS.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm text-slate-300">{u.name}</div>
                  <div className="flex-1">
                    <Sparkline data={u.driftTrend.map((d) => d.value)} color={u.behaviorScore < u.personalBaseline ? '#f97316' : '#22c55e'} width={300} height={28} />
                  </div>
                  <div className="w-12 text-right text-xs text-slate-400">{u.behaviorScore - u.personalBaseline > 0 ? '+' : ''}{u.behaviorScore - u.personalBaseline}</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Detection accuracy trend */}
      <motion.div variants={fadeUp}>
        <Card className="p-5">
          <SectionTitle title="Detection Accuracy Trend" subtitle="7-day rolling model performance" />
          <div className="flex items-end gap-2 h-40 mt-3">
            {detectionTrend.map((v, i) => {
              const max = 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500">{v}%</span>
                  <motion.div
                    className="w-full rounded-t-sm bg-green-500/50"
                    initial={{ height: 0 }}
                    animate={{ height: `${(v / max) * 100}%` }}
                    transition={{ delay: i * 0.08 }}
                  />
                  <span className="text-[10px] text-slate-600">D{i + 1}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, suffix, color, trend, invert }: { icon: typeof Target; label: string; value: number; suffix: string; color: string; trend: number[]; invert?: boolean }) {
  return (
    <Card hover className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        <Sparkline data={trend} color={invert ? '#ef4444' : color} width={70} height={28} />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">
          <AnimatedCounter value={value} decimals={value % 1 !== 0 ? 1 : 0} suffix={suffix} />
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </Card>
  );
}

function ProgressTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className="text-2xl font-bold text-white mb-2"><AnimatedCounter value={value} suffix="%" /></div>
      <ProgressBar value={value} color={color} />
    </div>
  );
}

function DonutChart({ data }: { data: { type: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 mt-2">
      <svg width={160} height={160} className="-rotate-90">
        <circle cx={80} cy={80} r={radius} fill="none" stroke="#1e293b" strokeWidth={14} />
        {data.map((d, i) => {
          const dash = (d.value / total) * circumference;
          const seg = (
            <motion.circle
              key={i}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={14}
              strokeDasharray={`${dash} ${circumference - dash}`}
              initial={{ strokeDashoffset: -offset }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="w-full space-y-1.5">
        {data.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-300 flex-1">{d.type}</span>
            <span className="text-slate-500">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
