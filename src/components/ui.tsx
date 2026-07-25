import { motion, useMotionValue, useTransform, animate, type Variants } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function AnimatedCounter({ value, decimals = 0, suffix = '', prefix = '', className = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string; className?: string }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 1, ease: 'easeOut' });
    return controls.stop;
  }, [value, motionValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
}

export function RiskGauge({ value, size = 120, label = 'Risk Score' }: { value: number; size?: number; label?: string }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#ef4444' : value >= 60 ? '#f97316' : value >= 40 ? '#eab308' : '#22c55e';

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={8} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedCounter value={value} className="text-2xl font-bold" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
    </div>
  );
}

export function MiniBar({ data, color = '#3b82f6', height = 40 }: { data: { value: number }[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-sm"
          style={{ background: color, opacity: 0.4 + (d.value / max) * 0.6 }}
          initial={{ height: 0 }}
          animate={{ height: `${(d.value / max) * 100}%` }}
          transition={{ duration: 0.5, delay: i * 0.03 }}
        />
      ))}
    </div>
  );
}

export function Sparkline({ data, color = '#3b82f6', height = 36, width = 120 }: { data: number[]; color?: string; height?: number; width?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function ProgressBar({ value, color = '#3b82f6', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-slate-800 overflow-hidden ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded-md bg-slate-800/50 ${className}`}>
    <div className="shimmer-bg absolute inset-0" />
  </div>;
}

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('');
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function StatusDot({ color = '#22c55e', pulse = false }: { color?: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function AreaLineChart({
  series,
  height = 220,
  yMax,
  formatY = (v: number) => `${v}`,
}: {
  series: { name: string; color: string; points: { label: string; value: number }[] }[];
  height?: number;
  yMax?: number;
  formatY?: (v: number) => string;
}) {
  const width = 760;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const max = yMax ?? Math.ceil(Math.max(...allValues) / 10) * 10;
  const min = 0;
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const xStep = labels.length > 1 ? innerW / (labels.length - 1) : innerW;

  function toPath(points: { value: number }[]) {
    return points
      .map((p, i) => {
        const x = padL + i * xStep;
        const y = padT + innerH - ((p.value - min) / (max - min)) * innerH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  function toAreaPath(points: { value: number }[]) {
    const line = toPath(points);
    const lastX = padL + (points.length - 1) * xStep;
    const baseY = padT + innerH;
    return `${line} L${lastX.toFixed(1)},${baseY.toFixed(1)} L${padL.toFixed(1)},${baseY.toFixed(1)} Z`;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + innerH - t * innerH);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 480 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {gridLines.map((y, i) => (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1e293b" strokeWidth={1} strokeDasharray="2 4" />
            <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-slate-600" style={{ fontSize: 9 }}>
              {formatY(Math.round(max * (1 - i / 4)))}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={padL + i * xStep} y={height - 6} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 9 }}>
            {l}
          </text>
        ))}
        {series.map((s, i) => (
          <g key={i}>
            <motion.path
              d={toAreaPath(s.points)}
              fill={`url(#area-grad-${i})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
            />
            <motion.path
              d={toPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: i * 0.1, ease: 'easeOut' }}
            />
            {s.points.map((p, j) => {
              const x = padL + j * xStep;
              const y = padT + innerH - ((p.value - min) / (max - min)) * innerH;
              return <circle key={j} cx={x} cy={y} r={2.5} fill={s.color} className="opacity-0 hover:opacity-100" />;
            })}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] text-slate-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  size = 160,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={thickness} />
          {data.map((d, i) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const offset = -cumulative;
            cumulative += dash;
            return (
              <motion.circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              />
            );
          })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="text-xl font-bold text-white">{centerValue}</span>}
            {centerLabel && <span className="text-[10px] uppercase tracking-wider text-slate-500">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 w-full">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-slate-300 flex-1">{d.label}</span>
            <span className="text-slate-500 font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RadialGauge({
  value,
  size = 140,
  thickness = 10,
  label = 'Risk Score',
  color,
}: {
  value: number;
  size?: number;
  thickness?: number;
  label?: string;
  color?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke = color ?? (value >= 80 ? '#ef4444' : value >= 60 ? '#f97316' : value >= 40 ? '#eab308' : '#22c55e');

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={thickness} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedCounter value={value} className="text-3xl font-bold text-white" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}
