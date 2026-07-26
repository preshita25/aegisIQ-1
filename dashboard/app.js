
const API_BASE = 'https://aegisiq-api.onrender.com';

// State
let state = {
  alerts: [],
  alertsTotal: 0,
  alertsPage: 0,
  alertsLimit: 25,
  entities: [],
  stats: {},
  labelDist: [],
  charts: {},
  debounceTimer: null,
};

// Chart.js Global Defaults
// Matches exact design tokens from aegisIQ-1 tailwind.config.js
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Inter', ui-sans-serif, system-ui, sans-serif";
  Chart.defaults.color = '#94a3b8';          // slate-400
  Chart.defaults.borderColor = '#1e293b';    // slate-800
  Chart.defaults.backgroundColor = 'rgba(59,130,246,0.1)';
  Chart.defaults.plugins.tooltip.backgroundColor = '#0b1120';
  Chart.defaults.plugins.tooltip.borderColor = '#1e293b';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
  Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

// Startup
window.addEventListener('DOMContentLoaded', async () => {
  startClock();
  await initApp();
});

async function initApp() {
  await checkAPI();
  await Promise.all([
    fetchStats(),
    loadAlerts(),
    loadEntities(),
  ]);
  renderDashboard();
  renderModelPage();
  hideLoading();
}

// ─── Clock ────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('topbarTime').textContent =
      now.toLocaleTimeString('en-US', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

// ─── API ──────────────────────────────────────────────────
async function apiFetch(path) {
  try {
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API error (${path}):`, err.message);
    return null;
  }
}

async function checkAPI() {
  const health = await apiFetch('/');
  const statusEl  = document.getElementById('apiStatus');
  const statusTxt = document.getElementById('apiStatusText');

  if (health) {
    statusEl.style.borderColor = 'rgba(34,197,94,0.30)';
    statusEl.style.backgroundColor = 'rgba(34,197,94,0.10)';
    statusTxt.textContent = `Online · ${health.alerts_loaded} alerts`;
  } else {
    statusEl.style.borderColor = 'rgba(239,68,68,0.30)';
    statusEl.style.backgroundColor = 'rgba(239,68,68,0.10)';
    statusTxt.style.color = '#f87171';
    statusTxt.textContent = 'Offline — demo mode';
    document.querySelector('.status-dot').style.background = '#ef4444';
    injectDemoData();
  }
}

// ─── Demo Data (when API is offline) ─────────────────────
function injectDemoData() {
  const LABELS = ['brute_force','impossible_travel','credential_stuffing',
                  'lateral_movement','device_spoofing','low_and_slow','insider_drift','normal'];
  const SEVS   = ['CRITICAL','HIGH','MEDIUM','LOW'];
  const GEOS   = ['US-NY','US-CA','UK-LDN','DE-BER','IN-MUM','BR-SAO','SG-SGP'];
  const RES    = ['/api/v1/users','/admin/config','/internal/secrets',
                  '/api/v1/payments','/api/v1/reports','/api/v1/orders'];

  function randEl(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randBetween(a,b) { return a + Math.random() * (b - a); }

  const demos = [];
  for (let i = 0; i < 120; i++) {
    const label = Math.random() < 0.08 ? 'normal' : randEl(LABELS.slice(0,7));
    const risk  = label === 'normal' ? randBetween(0.05,0.35) : randBetween(0.40,0.99);
    const sev   = risk >= 0.75 ? 'CRITICAL' : risk >= 0.50 ? 'HIGH' : risk >= 0.25 ? 'MEDIUM' : 'LOW';
    const eid   = `user_${String(Math.floor(Math.random()*80)).padStart(4,'0')}`;
    const ts    = new Date(Date.now() - Math.random()*30*24*3600*1000);

    demos.push({
      id: `ALT-${String(i).padStart(6,'0')}`,
      entity_id: eid,
      entity_type: 'user',
      timestamp: ts.toISOString(),
      geo_location: randEl(GEOS),
      resource_accessed: randEl(RES),
      auth_method: randEl(['password','token','certificate']),
      auth_success: Math.random() > 0.3,
      session_duration: randBetween(0.5, 45),
      source_ip: `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
      risk_score: parseFloat(risk.toFixed(4)),
      severity: sev,
      predicted_label: label,
      true_label: label,
      explanation_summary: `Flagged due to: ${label.replace(/_/g,' ')} pattern detected.`,
      explanation_factors: [
        { label: 'Off-hours access', shap: 0.28, direction: '↑ increases risk' },
        { label: 'Unusual location (vs baseline)', shap: 0.22, direction: '↑ increases risk' },
        { label: 'Authentication failure', shap: 0.15, direction: '↑ increases risk' },
        { label: 'New device fingerprint', shap: 0.12, direction: '↑ increases risk' },
      ],
      attack_description: getAttackDesc(label),
      risk_color: getRiskColor(label),
      correct: Math.random() > 0.15,
      class_probabilities: { normal: 1 - risk, [label]: risk },
    });
  }
  demos.sort((a,b) => b.risk_score - a.risk_score);
  state.alerts = demos;
  state.alertsTotal = demos.length;

  state.stats = {
    total_events: 14850,
    total_entities: 120,
    total_alerts: demos.length,
    anomaly_rate_pct: 2.45,
    weighted_f1: 0.8712,
    binary_precision: 0.8934,
    binary_recall: 0.8421,
    fp_rate_top1pct: 3.20,
    label_distribution: {
      normal: 13200, brute_force: 220, impossible_travel: 180,
      credential_stuffing: 150, lateral_movement: 140,
      device_spoofing: 85, low_and_slow: 52, insider_drift: 23,
    },
  };

  state.labelDist = [
    { label:'brute_force', count:220, pct:38.2 },
    { label:'impossible_travel', count:180, pct:31.2 },
    { label:'credential_stuffing', count:150, pct:26.0 },
    { label:'lateral_movement', count:140, pct:24.3 },
    { label:'device_spoofing', count:85, pct:14.7 },
    { label:'low_and_slow', count:52, pct:9.0 },
    { label:'insider_drift', count:23, pct:4.0 },
  ];

  // Demo entities
  state.entities = Array.from({ length: 30 }, (_, i) => ({
    entity_id: `user_${String(i).padStart(4,'0')}`,
    entity_type: i < 20 ? 'user' : i < 25 ? 'service_account' : 'edge_device',
    total_events: Math.floor(randBetween(50, 200)),
    anomaly_count: Math.floor(randBetween(0, 10)),
    anomaly_rate: parseFloat(randBetween(0, 8).toFixed(2)),
    last_seen: new Date(Date.now() - Math.random()*3*3600*1000).toISOString(),
  }));
}

function getAttackDesc(label) {
  const d = {
    normal: 'Normal access pattern.',
    brute_force: 'Rapid repeated authentication failures from a single source.',
    impossible_travel: 'Logins from geographically distant locations within an implausible time window.',
    credential_stuffing: 'Authentication attempts across many accounts from few source IPs.',
    lateral_movement: 'Entity accessing an unusual sequence of resources never touched before.',
    device_spoofing: 'Device re-appeared with a mismatched OS/MAC fingerprint vs. known history.',
    low_and_slow: 'Gradual off-hours resource access building up over multiple days.',
    insider_drift: 'Entity slowly expanding its privilege or resource footprint.',
  };
  return d[label] || 'Unknown anomaly type.';
}

function getRiskColor(label) {
  const c = {
    normal:'#22c55e', brute_force:'#ef4444', impossible_travel:'#f97316',
    credential_stuffing:'#ef4444', lateral_movement:'#f97316',
    device_spoofing:'#eab308', low_and_slow:'#f59e0b', insider_drift:'#a855f7',
  };
  return c[label] || '#94a3b8';
}

// ─── Data Fetching ────────────────────────────────────────
async function fetchStats() {
  const data = await apiFetch('/stats');
  if (data) state.stats = data;
}

async function loadAlerts(page = 0) {
  state.alertsPage = page;
  const sev    = document.getElementById('filterSeverity')?.value || '';
  const label  = document.getElementById('filterLabel')?.value    || '';
  const sort   = document.getElementById('filterSort')?.value     || 'risk_score';
  const entity = document.getElementById('filterEntity')?.value   || '';
  const offset = page * state.alertsLimit;

  const params = new URLSearchParams({
    limit: state.alertsLimit,
    offset,
    sort_by: sort,
    ...(sev && { severity: sev }),
    ...(label && { label }),
    ...(entity && { entity_id: entity }),
  });

  const data = await apiFetch(`/alerts?${params}`);
  if (data) {
    state.alerts = data.alerts;
    state.alertsTotal = data.total;
  }

  // If no API: filter demo data locally
  if (!data) {
    let filtered = [...(state.alerts.length ? state.alerts : [])];
    if (sev)    filtered = filtered.filter(a => a.severity === sev);
    if (label)  filtered = filtered.filter(a => a.predicted_label === label);
    if (entity) filtered = filtered.filter(a => a.entity_id.includes(entity));
    state.alertsTotal = filtered.length;
    state.alerts = filtered.slice(offset, offset + state.alertsLimit);
  }

  renderAlertsTable();
  renderAlertsPagination();
  renderRecentAlerts();
}

async function loadEntities() {
  const etype = document.getElementById('entityTypeFilter')?.value || '';
  const sort  = document.getElementById('entitySortFilter')?.value || 'anomaly_count';
  const params = new URLSearchParams({ limit: 200, sort_by: sort, ...(etype && { entity_type: etype }) });

  const data = await apiFetch(`/entities?${params}`);
  if (data) state.entities = data.entities;

  renderEntitiesGrid();
}

async function fetchLabelDist() {
  const data = await apiFetch('/label-distribution');
  if (data) state.labelDist = data.labels;
}

async function refreshData() {
  document.getElementById('refreshBtn').textContent = 'Refreshing...';
  await Promise.all([fetchStats(), loadAlerts(), loadEntities()]);
  renderDashboard();
  document.getElementById('refreshBtn').textContent = 'Refresh';
}

// ─── Dashboard Render ─────────────────────────────────────
function renderDashboard() {
  const s = state.stats;

  // KPIs
  setText('kpiTotalAlerts', fmtNum(s.total_alerts || state.alerts.length || 0));
  setText('kpiCritical', fmtNum(state.alerts.filter(a => a.severity === 'CRITICAL').length));
  setText('kpiF1', s.weighted_f1 ? (s.weighted_f1 * 100).toFixed(1) + '%' : '—');
  setText('kpiEntities', fmtNum(s.total_entities || state.entities.length));
  setText('kpiEvents', fmtNum(s.total_events));
  setText('kpiFPRate', s.fp_rate_top1pct != null ? s.fp_rate_top1pct + '%' : '—');
  setText('kpiAlertsDelta', `↑ ${(s.anomaly_rate_pct || 2.5).toFixed(2)}% anomaly rate`);
  setText('kpiCriticalDelta', `${state.alerts.filter(a=>a.severity==='CRITICAL').length} require immediate action`);

  // Alert badge
  setText('navAlertBadge', state.alerts.length);

  renderCharts();
  renderTopEntities();
  renderRecentAlerts();
}

// ─── Charts ───────────────────────────────────────────────
const CHART_COLORS = {
  brute_force:         '#2d428a',
  impossible_travel:   '#f97316',
  credential_stuffing: '#ef4444',
  lateral_movement:    '#eea673',
  device_spoofing:     '#eab308',
  low_and_slow:        '#026634',
  insider_drift:       '#337cf3',
  normal:              '#2af072',
};

function renderCharts() {
  renderLabelDistChart();
  renderRiskDistChart();
  renderSeverityChart();
}

function renderLabelDistChart() {
  const ctx = document.getElementById('labelDistChart');
  if (!ctx) return;
  if (state.charts.labelDist) state.charts.labelDist.destroy();

  const allAlerts = state.alerts;
  const labelCounts = {};
  allAlerts.forEach(a => {
    const l = a.predicted_label || 'unknown';
    labelCounts[l] = (labelCounts[l] || 0) + 1;
  });

  // Also use label_distribution from stats if available
  if (state.stats.label_distribution) {
    Object.entries(state.stats.label_distribution).forEach(([k,v]) => {
      if (k !== 'normal') labelCounts[k] = (labelCounts[k] || 0);
    });
  }

  const labels = Object.keys(labelCounts).filter(l => l !== 'normal');
  const data   = labels.map(l => labelCounts[l]);
  const colors = labels.map(l => CHART_COLORS[l] || '#6366f1');

  state.charts.labelDist = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.replace(/_/g,' ')),
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#020617' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, padding: 14, boxWidth: 10, boxHeight: 10 } },
      },
      cutout: '68%',
    },
  });
}

function renderRiskDistChart() {
  const ctx = document.getElementById('riskDistChart');
  if (!ctx) return;
  if (state.charts.riskDist) state.charts.riskDist.destroy();

  const bins = new Array(10).fill(0);
  state.alerts.forEach(a => {
    const idx = Math.min(Math.floor(a.risk_score * 10), 9);
    bins[idx]++;
  });

  const labels = ['0-10','10-20','20-30','30-40','40-50','50-60','60-70','70-80','80-90','90-100'];
  const bgColors = bins.map((_, i) => i < 4 ? 'rgba(34,197,94,0.6)' : i < 7 ? 'rgba(234,179,8,0.6)' : 'rgba(239,68,68,0.6)');

  state.charts.riskDist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Events',
        data: bins,
        backgroundColor: bgColors,
        borderRadius: 6,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10, family:'Inter' } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#64748b', font: { size: 10, family:'Inter' } }, grid: { color: 'rgba(30,41,59,0.60)' }, border: { display: false } },
      },
    },
  });
}

function renderSeverityChart() {
  const ctx = document.getElementById('severityChart');
  if (!ctx) return;
  if (state.charts.severity) state.charts.severity.destroy();

  const sevCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  state.alerts.forEach(a => { if (sevCounts[a.severity] !== undefined) sevCounts[a.severity]++; });

  state.charts.severity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [sevCounts.CRITICAL, sevCounts.HIGH, sevCounts.MEDIUM, sevCounts.LOW],
        backgroundColor: ['rgba(239,68,68,0.75)','rgba(249,115,22,0.75)','rgba(234,179,8,0.75)','rgba(34,197,94,0.75)'],
        borderRadius: 6,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10, family:'Inter' } }, grid: { color: 'rgba(30,41,59,0.60)' }, border: { display: false } },
        y: { ticks: { color: '#94a3b8', font: { size: 11, family:'Inter' } }, grid: { display: false }, border: { display: false } },
      },
    },
  });
}

// ─── Top Risk Entities ────────────────────────────────────
function renderTopEntities() {
  const el = document.getElementById('topEntitiesBody');
  if (!el) return;

  const entByAnomaly = [...state.entities]
    .sort((a, b) => b.anomaly_count - a.anomaly_count)
    .slice(0, 6);

  if (!entByAnomaly.length) {
    el.innerHTML = '<div class="text-muted" style="font-size:0.8rem">No entity data</div>';
    return;
  }

  el.innerHTML = entByAnomaly.map(e => {
    const rate = e.anomaly_rate || (e.anomaly_count / Math.max(e.total_events, 1) * 100);
    const pct  = Math.min(rate / 10 * 100, 100).toFixed(0);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer"
           onclick="showPage('entities')">
        <div class="entity-avatar ${e.entity_type}" style="width:28px;height:28px;font-size:0.7rem">
          ${entityIcon(e.entity_type)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.entity_id}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${e.anomaly_count} anomalies / ${e.total_events} events</div>
        </div>
        <div style="min-width:80px">
          <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.06);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22c55e,#ef4444);border-radius:2px"></div>
          </div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;text-align:right">${rate.toFixed(1)}%</div>
        </div>
      </div>`;
  }).join('');
}

// ─── Alerts Table ─────────────────────────────────────────
function renderRecentAlerts() {
  const tbody = document.getElementById('recentAlertsBody');
  if (!tbody) return;
  const recent = [...state.alerts].sort((a,b)=>b.risk_score-a.risk_score).slice(0,8);
  tbody.innerHTML = renderAlertRows(recent);
}

function renderAlertsTable() {
  const tbody = document.getElementById('alertsTableBody');
  if (!tbody) return;
  const count = document.getElementById('alertCount');
  if (count) count.textContent = `${fmtNum(state.alertsTotal)} alerts`;

  if (!state.alerts.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-text">No alerts match your filters</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.alerts.map(a => `
    <tr class="alert-row" onclick="openDetail('${a.id}')">
      <td><span class="text-mono" style="font-size:0.75rem;color:var(--text-muted)">${a.id}</span></td>
      <td>
        <div style="font-size:0.8rem;font-weight:600">${a.entity_id}</div>
        <div style="font-size:0.65rem;color:var(--text-muted)">${a.entity_type}</div>
      </td>
      <td><span class="text-mono" style="font-size:0.72rem;color:var(--text-secondary)">${fmtTS(a.timestamp)}</span></td>
      <td><span class="label-chip ${a.predicted_label}">${a.predicted_label.replace(/_/g,' ')}</span></td>
      <td><span class="severity-badge ${a.severity}">● ${a.severity}</span></td>
      <td>
        <div class="risk-bar-wrap">
          <div class="risk-bar">
            <div class="risk-bar-fill" style="width:${(a.risk_score*100).toFixed(0)}%;background:${riskGradient(a.risk_score)}"></div>
          </div>
          <span class="risk-val" style="color:${riskColor(a.risk_score)}">${(a.risk_score*100).toFixed(0)}%</span>
        </div>
      </td>
      <td style="font-size:0.75rem;color:var(--text-secondary)">${a.geo_location}</td>
      <td style="font-size:0.72rem;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.resource_accessed}</td>
      <td>${a.auth_success
        ? '<span style="color:#4ade80;font-size:0.7rem">✓ OK</span>'
        : '<span style="color:#f87171;font-size:0.7rem">✗ FAIL</span>'}</td>
    </tr>
  `).join('');
}

function renderAlertRows(alerts) {
  return alerts.map(a => `
    <tr class="alert-row" onclick="openDetail('${a.id}')">
      <td><span class="text-mono" style="font-size:0.72rem;color:var(--text-muted)">${a.id}</span></td>
      <td style="font-size:0.8rem;font-weight:600">${a.entity_id}</td>
      <td><span class="text-mono" style="font-size:0.72rem;color:var(--text-secondary)">${fmtTS(a.timestamp)}</span></td>
      <td><span class="label-chip ${a.predicted_label}">${a.predicted_label.replace(/_/g,' ')}</span></td>
      <td><span class="severity-badge ${a.severity}">● ${a.severity}</span></td>
      <td>
        <div class="risk-bar-wrap">
          <div class="risk-bar">
            <div class="risk-bar-fill" style="width:${(a.risk_score*100).toFixed(0)}%;background:${riskGradient(a.risk_score)}"></div>
          </div>
          <span class="risk-val" style="color:${riskColor(a.risk_score)}">${(a.risk_score*100).toFixed(0)}%</span>
        </div>
      </td>
      <td style="font-size:0.75rem;color:var(--text-secondary)">${a.resource_accessed}</td>
    </tr>
  `).join('');
}

// ─── Alert Pagination ─────────────────────────────────────
function renderAlertsPagination() {
  const el = document.getElementById('alertsPagination');
  if (!el) return;
  const totalPages = Math.ceil(state.alertsTotal / state.alertsLimit);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const cur = state.alertsPage;
  let html = '';

  html += `<button class="page-btn" ${cur===0?'disabled':''} onclick="loadAlerts(${cur-1})">‹</button>`;
  for (let i = Math.max(0, cur-2); i < Math.min(totalPages, cur+3); i++) {
    html += `<button class="page-btn ${i===cur?'active':''}" onclick="loadAlerts(${i})">${i+1}</button>`;
  }
  html += `<button class="page-btn" ${cur>=totalPages-1?'disabled':''} onclick="loadAlerts(${cur+1})">›</button>`;

  el.innerHTML = html;
}

// ─── Entity Grid ──────────────────────────────────────────
function renderEntitiesGrid() {
  const grid = document.getElementById('entitiesGrid');
  if (!grid) return;

  if (!state.entities.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">No entities found</div></div>';
    return;
  }

  grid.innerHTML = state.entities.map(e => {
    const rate = e.anomaly_rate || (e.anomaly_count / Math.max(e.total_events,1) * 100);
    const pct  = Math.min(rate/10*100, 100);
    const icon = entityIcon(e.entity_type);
    const initial = e.entity_id.charAt(0).toUpperCase();
    return `
      <div class="entity-card" onclick="openEntityDetail('${e.entity_id}')">
        <div class="entity-header">
          <div class="entity-avatar ${e.entity_type}">${icon}</div>
          <div>
            <div class="entity-id">${e.entity_id}</div>
            <div class="entity-type-badge">${e.entity_type.replace(/_/g,' ')}</div>
          </div>
          ${e.anomaly_count > 5 ? '<span class="severity-badge CRITICAL" style="margin-left:auto">● HIGH RISK</span>' : ''}
        </div>
        <div class="entity-stats">
          <div class="entity-stat-item">
            <div class="entity-stat-val">${fmtNum(e.total_events)}</div>
            <div class="entity-stat-label">Events</div>
          </div>
          <div class="entity-stat-item">
            <div class="entity-stat-val" style="color:${e.anomaly_count > 3 ? 'var(--risk-critical)' : 'var(--text-primary)'}">${e.anomaly_count}</div>
            <div class="entity-stat-label">Anomalies</div>
          </div>
          <div class="entity-stat-item">
            <div class="entity-stat-val">${rate.toFixed(1)}%</div>
            <div class="entity-stat-label">Anom. Rate</div>
          </div>
        </div>
        <div class="entity-anomaly-rate" style="margin-top:12px">
          <div class="entity-anomaly-fill" style="width:${pct.toFixed(0)}%"></div>
        </div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:6px">
          Last seen: ${fmtTS(e.last_seen)}
        </div>
      </div>
    `;
  }).join('');
}

// ─── Detail Panel ─────────────────────────────────────────
let allAlertsCache = {};

async function openDetail(alertId) {
  // Try cache first
  let alert = allAlertsCache[alertId] || state.alerts.find(a => a.id === alertId);

  if (!alert) {
    const data = await apiFetch(`/alerts/${alertId}`);
    if (data) { alert = data; allAlertsCache[alertId] = data; }
  }

  if (!alert) return;

  document.getElementById('detailAlertId').textContent = alert.id;
  document.getElementById('detailPanel').classList.add('open');

  const riskPct = (alert.risk_score * 100).toFixed(0);
  const sevColor = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#22c55e' }[alert.severity] || '#94a3b8';

  // Class probs HTML
  const probs = alert.class_probabilities || {};
  const probsHtml = Object.entries(probs)
    .sort((a,b) => b[1]-a[1])
    .map(([cls, p]) => `
      <div class="prob-item">
        <div class="prob-name">${cls.replace(/_/g,' ')}</div>
        <div class="prob-bar-wrap">
          <div class="prob-bar">
            <div class="prob-bar-fill" style="width:${(p*100).toFixed(0)}%;background:${CHART_COLORS[cls]||'var(--accent-blue)'}"></div>
          </div>
        </div>
        <div class="prob-val">${(p*100).toFixed(1)}%</div>
      </div>
    `).join('');

  // Factors HTML
  const factors = (alert.explanation_factors || []).map(f => `
    <div class="factor-item">
      <div class="factor-label">${f.label}</div>
      <span class="factor-shap ${(f.shap||0)>0?'pos':'neg'}">${(f.shap||0)>0?'+':''}${(f.shap||0).toFixed(3)}</span>
      <div style="font-size:0.65rem;color:var(--text-muted)">${f.direction||''}</div>
    </div>
  `).join('');

  document.getElementById('detailBody').innerHTML = `
    <!-- Risk Display -->
    <div class="detail-section">
      <div class="detail-section-title">Risk Assessment</div>
      <div class="detail-risk-display">
        <div class="risk-circle">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
            <circle cx="36" cy="36" r="30" fill="none" stroke="${sevColor}" stroke-width="6"
              stroke-dasharray="${(188.5 * alert.risk_score).toFixed(1)} 188.5"
              stroke-linecap="round" opacity="0.85"/>
          </svg>
          <div class="risk-circle-num" style="color:${sevColor}">${riskPct}%</div>
        </div>
        <div>
          <span class="severity-badge ${alert.severity}" style="font-size:0.75rem">● ${alert.severity}</span>
          <div style="margin-top:8px">
            <span class="label-chip ${alert.predicted_label}">${alert.predicted_label.replace(/_/g,' ')}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">${alert.attack_description||''}</div>
        </div>
      </div>
    </div>

    <!-- Explanation -->
    <div class="detail-section">
      <div class="detail-section-title">Explanation</div>
      <div class="explanation-box">
        <strong>🔍 Analysis: </strong>${alert.explanation_summary || 'No explanation available.'}
      </div>
      ${factors ? `<div class="factor-list">${factors}</div>` : ''}
    </div>

    <!-- Class Probabilities -->
    <div class="detail-section">
      <div class="detail-section-title">Class Probabilities</div>
      <div class="prob-grid">${probsHtml}</div>
    </div>

    <!-- Event Metadata -->
    <div class="detail-section">
      <div class="detail-section-title">Event Metadata</div>
      <div class="detail-meta-grid">
        <div class="meta-item">
          <div class="meta-label">Entity</div>
          <div class="meta-value">${alert.entity_id}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Type</div>
          <div class="meta-value">${alert.entity_type}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Timestamp</div>
          <div class="meta-value mono">${fmtTS(alert.timestamp)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Source IP</div>
          <div class="meta-value mono">${alert.source_ip || '—'}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Geo Location</div>
          <div class="meta-value">${alert.geo_location}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Auth Method</div>
          <div class="meta-value">${alert.auth_method}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Auth Success</div>
          <div class="meta-value">${alert.auth_success
            ? '<span style="color:#4ade80">✓ Success</span>'
            : '<span style="color:#f87171">✗ Failed</span>'}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Session Duration</div>
          <div class="meta-value">${(alert.session_duration||0).toFixed(1)} min</div>
        </div>
        <div class="meta-item" style="grid-column:1/-1">
          <div class="meta-label">Resource</div>
          <div class="meta-value mono">${alert.resource_accessed}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Ground Truth</div>
          <div class="meta-value">
            <span class="label-chip ${alert.true_label}">${alert.true_label}</span>
            ${alert.correct ? ' <span style="color:#4ade80;font-size:0.7rem">✓ correct</span>' : ' <span style="color:#f87171;font-size:0.7rem">✗ misclassified</span>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function openEntityDetail(entityId) {
  // Show filtered alerts for entity
  document.getElementById('filterEntity').value = entityId;
  showPage('alerts');
  loadAlerts();
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
}

// ─── Live Scoring ─────────────────────────────────────────
async function scoreEvent() {
  const btn = document.getElementById('scoreBtn');
  btn.textContent = '⏳ Scoring...';
  btn.disabled = true;

  const payload = {
    entity_id:    document.getElementById('sf-entity-id').value,
    entity_type:  document.getElementById('sf-entity-type').value,
    geo_location: document.getElementById('sf-geo').value,
    resource_accessed: document.getElementById('sf-resource').value,
    auth_method:  document.getElementById('sf-auth-method').value,
    auth_success: document.getElementById('sf-auth-success').value === 'true',
    session_duration: parseFloat(document.getElementById('sf-session-dur').value),
    source_ip:    document.getElementById('sf-source-ip').value,
    timestamp:    new Date().toISOString(),
  };

  let result = null;
  try {
    const res = await fetch(API_BASE + '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    result = await res.json();
  } catch(e) {
    // Demo fallback
    const risk = (!payload.auth_success ? 0.3 : 0)
      + (['US-NY','US-CA','US-TX'].includes(payload.geo_location) ? 0 : 0.2)
      + (['/admin/config','/internal/secrets','/internal/keys'].includes(payload.resource_accessed) ? 0.35 : 0);
    const sev = risk >= 0.75 ? 'CRITICAL' : risk >= 0.5 ? 'HIGH' : risk >= 0.25 ? 'MEDIUM' : 'LOW';
    result = {
      entity_id: payload.entity_id,
      risk_score: Math.min(risk, 1).toFixed(4),
      severity: sev,
      predicted_label: risk > 0.6 ? 'lateral_movement' : 'normal',
      explanation_summary: risk > 0.3 ? 'Flagged due to: unusual resource access + location anomaly.' : 'Normal access pattern.',
      reasons: risk > 0.3 ? ['Unusual resource', 'Geographic anomaly'] : [],
    };
  }

  const resEl = document.getElementById('scoreResult');
  const rPct  = (parseFloat(result.risk_score) * 100).toFixed(1);
  const sevColor = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#22c55e' }[result.severity] || '#94a3b8';

  document.getElementById('scoreResultContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Risk Score</div>
        <div style="font-size:2.5rem;font-weight:800;font-family:var(--font-mono);color:${sevColor}">${rPct}%</div>
      </div>
      <div>
        <span class="severity-badge ${result.severity}" style="font-size:0.82rem;padding:6px 14px">● ${result.severity}</span>
        <div style="margin-top:8px"><span class="label-chip ${result.predicted_label}">${result.predicted_label.replace(/_/g,' ')}</span></div>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:6px">Analysis</div>
        <div style="font-size:0.82rem;color:var(--text-secondary)">${result.explanation_summary}</div>
        ${result.reasons && result.reasons.length
          ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
               ${result.reasons.map(r => `<span class="label-chip">${r}</span>`).join('')}
             </div>` : ''}
      </div>
    </div>
  `;
  resEl.classList.add('visible');
  resEl.style.borderColor = sevColor + '44';

  btn.textContent = '⚡ Score Event';
  btn.disabled = false;
}

function loadScenario(scenario) {
  const scenarios = {
    brute: { resource:'/api/v1/users', auth_success:'false', geo:'US-NY', auth_method:'password' },
    lateral: { resource:'/internal/secrets', auth_success:'true', geo:'DE-BER', auth_method:'token' },
    offhours: { resource:'/admin/config', auth_success:'true', geo:'US-CA', auth_method:'certificate' },
    normal: { resource:'/api/v1/orders', auth_success:'true', geo:'US-NY', auth_method:'token' },
  };
  const s = scenarios[scenario];
  if (!s) return;

  document.getElementById('sf-resource').value    = s.resource;
  document.getElementById('sf-auth-success').value = s.auth_success;
  document.getElementById('sf-geo').value         = s.geo;
  document.getElementById('sf-auth-method').value = s.auth_method;
}

// ─── Model Info Page ──────────────────────────────────────
function renderModelPage() {
  const s = state.stats;

  // Architecture diagram
  const archEl = document.getElementById('archDiagram');
  if (archEl) {
    const steps = [
      { icon:'□', label:'Synthetic Data Generator', desc:'NumPy + Faker · 8 attack patterns · Per-entity profiles', color:'var(--accent-blue)' },
      { icon:'○', label:'Baseline Profiler', desc:'Per-entity statistical profiles + One-Class SVM fallback', color:'var(--accent-cyan)' },
      { icon:'●', label:'LSTM Autoencoder', desc:'Sequence-aware · Reconstruction error · Drift-aware threshold', color:'var(--accent-purple)' },
      { icon:'◆', label:'XGBoost Classifier', desc:'8-class · SMOTE · SHAP explainability · Calibrated probs', color:'var(--risk-high)' },
      { icon:'◑', label:'Explainability Layer', desc:'SHAP TreeExplainer · Natural-language summaries · Feature attribution', color:'var(--accent-green)' },
      { icon:'■', label:'Analyst Dashboard', desc:'Ranked alert queue · Risk scores · Entity history · Live scoring', color:'var(--accent-blue)' },
    ];
    archEl.innerHTML = steps.map((s,i) => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px">
        <div style="width:36px;height:36px;background:${s.color}22;border:1px solid ${s.color}44;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${s.icon}</div>
        <div>
          <div style="font-size:0.82rem;font-weight:600">${i+1}. ${s.label}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${s.desc}</div>
        </div>
      </div>
    `).join('');
  }

  // Attack taxonomy
  const taxEl = document.getElementById('attackTaxonomy');
  if (taxEl) {
    const attacks = [
      { label:'Brute Force', color:'#ef4444', type:'Anomaly', icon:'🔨' },
      { label:'Impossible Travel', color:'#f97316', type:'Anomaly', icon:'✈️' },
      { label:'Credential Stuffing', color:'#dc2626', type:'Anomaly', icon:'🔑' },
      { label:'Lateral Movement', color:'#f97316', type:'Anomaly', icon:'↔️' },
      { label:'Device Spoofing', color:'#eab308', type:'Anomaly', icon:'📱' },
      { label:'Low & Slow Exfiltration', color:'#f59e0b', type:'Anomaly', icon:'🐢' },
      { label:'Insider Drift', color:'#a855f7', type:'Edge Case', icon:'👤' },
      { label:'Normal Baseline', color:'#22c55e', type:'Benign', icon:'✅' },
    ];
    taxEl.innerHTML = attacks.map(a => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-glass);border:1px solid var(--border);border-radius:6px">
        <span style="font-size:0.9rem">${a.icon}</span>
        <div style="flex:1;font-size:0.8rem;font-weight:500">${a.label}</div>
        <span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:100px;background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.type}</span>
      </div>
    `).join('');
  }

  // Metrics
  const metricsEl = document.getElementById('metricsBody');
  if (metricsEl && s.weighted_f1) {
    const metrics = [
      { label:'Weighted F1 Score', val: `${(s.weighted_f1*100).toFixed(2)}%`, color:'var(--accent-green)', icon:'🎯' },
      { label:'Binary Precision', val: s.binary_precision ? `${(s.binary_precision*100).toFixed(2)}%` : '—', color:'var(--accent-blue)', icon:'📏' },
      { label:'Binary Recall', val: s.binary_recall ? `${(s.binary_recall*100).toFixed(2)}%` : '—', color:'var(--accent-cyan)', icon:'🔍' },
      { label:'FP Rate @Top-1%', val: s.fp_rate_top1pct != null ? `${s.fp_rate_top1pct}%` : '—', color:'var(--risk-medium)', icon:'⚡' },
      { label:'Anomaly Rate', val: `${s.anomaly_rate_pct}%`, color:'var(--accent-purple)', icon:'📊' },
      { label:'Total Events', val: fmtNum(s.total_events), color:'var(--text-secondary)', icon:'📋' },
    ];
    metricsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${metrics.map(m => `
          <div style="padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:10px">
            <div style="font-size:1.1rem;margin-bottom:6px">${m.icon}</div>
            <div style="font-size:1.5rem;font-weight:800;color:${m.color};font-family:var(--font-mono)">${m.val}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${m.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// ─── Page Navigation ──────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const nav  = document.getElementById(`nav-${pageId}`);

  if (page) page.classList.add('active');
  if (nav)  nav.classList.add('active');

  closeDetail();

  if (pageId === 'entities') loadEntities();
  if (pageId === 'alerts')   loadAlerts();
}

// ─── Filters ──────────────────────────────────────────────
function clearFilters() {
  document.getElementById('filterSeverity').value = '';
  document.getElementById('filterLabel').value    = '';
  document.getElementById('filterSort').value     = 'risk_score';
  document.getElementById('filterEntity').value   = '';
  loadAlerts();
}

function debounceLoadAlerts() {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => loadAlerts(), 400);
}

function updateDashboard() {
  // Dashboard time filter — in a real app would re-fetch with time range
  renderDashboard();
}

// ─── Loading ──────────────────────────────────────────────
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.style.display = 'none'; }, 600);
}

// ─── Helpers ──────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmtNum(n) {
  if (n == null || n === '—') return '—';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtTS(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' ' +
           d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
  } catch(e) { return ts; }
}

function riskColor(score) {
  if (score >= 0.75) return '#f87171';
  if (score >= 0.50) return '#fb923c';
  if (score >= 0.25) return '#fbbf24';
  return '#4ade80';
}

function riskGradient(score) {
  if (score >= 0.75) return 'linear-gradient(90deg,#f97316,#ef4444)';
  if (score >= 0.50) return 'linear-gradient(90deg,#eab308,#f97316)';
  if (score >= 0.25) return 'linear-gradient(90deg,#22c55e,#eab308)';
  return '#22c55e';
}

function entityIcon(type) {
  return { user:'👤', service_account:'⚙️', edge_device:'📡' }[type] || '?';
}
