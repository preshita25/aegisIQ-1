import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ShieldAlert, Users, FlaskConical, BarChart3, Settings, ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { ANALYST } from '@/lib/mockData';
import { Avatar, StatusDot } from './ui';

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null },
      { to: '/alerts', label: 'Alert Investigation', icon: ShieldAlert, badgeKey: 'alerts' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/profiles', label: 'Behavioral Profiles', icon: Users, badgeKey: 'profiles' },
      { to: '/scenarios', label: 'Scenario Studio', icon: FlaskConical, badgeKey: null },
      { to: '/analytics', label: 'Security Analytics', icon: BarChart3, badgeKey: null },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, badgeKey: null },
    ],
  },
];

export function Sidebar({ open }: { open: boolean }) {
  const location = useLocation();
  const { alerts } = useApp();
  const newAlerts = alerts.filter((a) => a.status === 'new').length;
  const driftCount = 3;

  function getBadge(key: string | null): number {
    if (key === 'alerts') return newAlerts;
    if (key === 'profiles') return driftCount;
    return 0;
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => {}} />}
      <aside
        className={`fixed z-40 h-full w-52 shrink-0 border-r border-slate-800/80 bg-[#0a0e1a] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-800/80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 border border-brand-500/30">
            <ShieldCheck className="h-4.5 w-4.5 text-brand-400" style={{ width: 18, height: 18 }} />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">AegisIQ</span>
        </div>

        {/* Systems status pill */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5">
            <StatusDot color="#22c55e" pulse />
            <span className="text-[11px] font-medium text-green-400">Systems Operational</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-1 overflow-y-auto scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.to;
                  const badge = getBadge(item.badgeKey);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                        active
                          ? 'text-white bg-brand-500/15 border border-brand-500/25'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <item.icon className="relative h-4 w-4 shrink-0" />
                      <span className="relative flex-1 text-[13px]">{item.label}</span>
                      {badge > 0 && (
                        <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Avatar name={ANALYST.name} color={ANALYST.avatarColor} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-200">{ANALYST.name}</div>
              <div className="truncate text-[10px] text-slate-500">{ANALYST.role}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
