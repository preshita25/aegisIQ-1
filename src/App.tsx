import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { Dashboard } from '@/pages/Dashboard';
import { AlertInvestigation } from '@/pages/AlertInvestigation';
import { BehavioralProfiles } from '@/pages/BehavioralProfiles';
import { ScenarioStudio } from '@/pages/ScenarioStudio';
import { SecurityAnalytics } from '@/pages/SecurityAnalytics';
import { Settings } from '@/pages/Settings';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar open={sidebarOpen} />
      <div className="lg:pl-60">
        <TopNav onMenu={() => setSidebarOpen((v) => !v)} />
        <main className="px-4 py-6 lg:px-6 lg:py-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<AlertInvestigation />} />
            <Route path="/profiles" element={<BehavioralProfiles />} />
            <Route path="/scenarios" element={<ScenarioStudio />} />
            <Route path="/analytics" element={<SecurityAnalytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProvider>
  );
}
