import { Search, Bell, ChevronDown, Brain, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ANALYST } from '@/lib/mockData';
import { useApp } from '@/lib/store';
import { Avatar } from './ui';

export function TopNav({ onMenu }: { onMenu: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const { alerts } = useApp();
  const newAlerts = alerts.filter((a) => a.status === 'new');

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = time.toISOString().slice(0, 10);
  const timeStr = time.toTimeString().slice(0, 8);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-800/80 bg-[#0a0e1a]/95 px-4 backdrop-blur-md">
      <button onClick={onMenu} className="btn-ghost p-2 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        <input
          placeholder="Search alerts, users, devices…"
          className="w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-12 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-brand-500/50 focus:outline-none focus:bg-slate-900"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 border border-slate-700 rounded px-1">⌘K</span>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Live clock */}
        <span className="hidden md:block text-[12px] font-mono text-slate-400">
          {dateStr} <span className="text-slate-200">{timeStr}</span> <span className="text-slate-500">UTC</span>
        </span>

        {/* Risk badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">Elevated</span>
        </div>

        {/* Model badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1">
          <Brain className="h-3.5 w-3.5 text-brand-400" />
          <span className="text-[11px] font-medium text-brand-300">Model Active</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotifOpen((v) => !v)} className="relative rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-slate-200 transition-colors">
            <Bell className="h-4 w-4" />
            {newAlerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {newAlerts.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-900 shadow-card-hover z-50"
              >
                <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {newAlerts.length > 0 && <span className="chip bg-red-500/10 text-red-400">{newAlerts.length} new</span>}
                </div>
                <div className="max-h-72 overflow-y-auto scrollbar-thin">
                  {newAlerts.length === 0 && <div className="px-4 py-6 text-center text-xs text-slate-500">No new alerts</div>}
                  {newAlerts.map((a) => (
                    <div key={a.id} className="border-b border-slate-800/60 px-4 py-3 hover:bg-slate-800/40">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-200 line-clamp-1">{a.title}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{a.user} · {a.location}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 cursor-pointer hover:border-slate-700 transition-colors">
          <Avatar name={ANALYST.name} color={ANALYST.avatarColor} size={24} />
          <span className="hidden sm:block text-xs font-medium text-slate-200">Preshita</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </div>
      </div>
    </header>
  );
}
