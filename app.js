/* ═══════════════════════════════════════════════
   AEROBIC.SPACE — Dashboard Application JS
   ═══════════════════════════════════════════════ */

'use strict';

/* ── STATE ── */
let DB = null;
let cdComp = null, cdDisc = null, cdAge = null;
let rpRef = null, rpTabMode = 'exec';
const charts = {};
const csvBuf = { ref: null, perf: null, assess: null };

/* ══════════════════════════════════
   NAVIGATION
══════════════════════════════════ */
function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const ni = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (ni) ni.classList.add('active');

  // Scroll main to top
  document.querySelector('.main')?.scrollTo(0, 0);
}

/* ══════════════════════════════════
   FORMATTERS
══════════════════════════════════ */
const pct  = v => (v == null || isNaN(v)) ? '—' : v.toFixed(1) + '%';
const num  = (v, d = 3) => (v == null || isNaN(v)) ? '—' : (+v).toFixed(d);
const fn   = v => (v == null || isNaN(v)) ? '—' : (+v).toFixed(2);

function accBadge(a) {
  if (a === 'bullseye') return `<span class="acc-badge bullseye"><span class="acc-dot"></span>В яблочко</span>`;
  if (a === 'ok')       return `<span class="acc-badge ok"><span class="acc-dot"></span>Допустимо</span>`;
  return                       `<span class="acc-badge bad"><span class="acc-dot"></span>Серьёзное</span>`;
}

function accBar(bullseye, ok, bad) {
  const b = bullseye || 0, o = ok || 0, r = bad || 0;
  const rest = Math.max(0, 100 - b - o - r);
  const total = b + o;
  return `
    <div class="acc-bar-wrap">
      <div class="acc-bar">
        <div class="seg-g" style="width:${b}%;height:100%"></div>
        <div class="seg-y" style="width:${o}%;height:100%"></div>
        <div class="seg-r" style="width:${r}%;height:100%"></div>
        <div class="seg-e" style="width:${rest}%;height:100%"></div>
      </div>
      <div class="acc-pct">✓ ${pct(total)}</div>
    </div>`;
}

function biasColor(bias) {
  if (bias == null) return '#94a3b8';
  if (Math.abs(bias) < 0.05) return '#10B981';
  if (Math.abs(bias) < 0.15) return '#F59E0B';
  return '#EF4444';
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function compTypeBadge(type) {
  if (type === 'RUSSIA') return `<span class="comp-type russia">Всерос.</span>`;
  if (type === 'REGION') return `<span class="comp-type region">Регион.</span>`;
  return `<span class="comp-type">${type || '—'}</span>`;
}

/* ══════════════════════════════════
   GAUGE RING SVG
══════════════════════════════════ */
function gaugeRing(value, label, color, max = 100) {
  const pct = Math.min(100, Math.max(0, value == null ? 0 : value));
  const r = 32, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const valTxt = value == null ? '—' : (pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)) + '%';
  return `
    <div class="gauge-wrap">
      <svg class="gauge-svg" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}1a" stroke-width="7"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
          stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ / 4}"
          stroke-linecap="round" style="transition:stroke-dasharray .6s cubic-bezier(.34,1.56,.64,1)"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Lexend" font-weight="800" font-size="14" fill="${color}">${valTxt}</text>
      </svg>
      <div class="gauge-label" style="color:${color}">${label}</div>
    </div>`;
}

/* ══════════════════════════════════
   DATA STATUS
══════════════════════════════════ */
function updateDataStatus() {
  const dot = document.getElementById('data-status-dot');
  const txt = document.getElementById('data-status-text');
  if (!DB) {
    dot.className = 'data-status-dot';
    txt.textContent = 'Нет данных';
    return;
  }
  dot.className = 'data-status-dot loaded';
  const total = DB.assessments?.length || 0;
  txt.textContent = `${total.toLocaleString('ru')} оценок`;

  // Nav pills
  const compPill = document.getElementById('nav-comp-count');
  const refPill  = document.getElementById('nav-ref-count');
  if (DB.competitions?.length) {
    compPill.textContent = DB.competitions.length;
    compPill.classList.add('visible');
  }
  if (DB.referees?.length) {
    refPill.textContent = DB.referees.length;
    refPill.classList.add('visible');
  }
}

/* ══════════════════════════════════
   PAGE: COMPETITIONS
══════════════════════════════════ */
function renderComps() {
  if (!DB) return;
  const tbody = document.getElementById('comp-tbody');
  const search = (document.getElementById('comp-search')?.value || '').toLowerCase();
  const typeF  = document.getElementById('comp-type-filter')?.value || '';

  let comps = DB.competitions.filter(c => {
    const matchText = !search || c.competition.toLowerCase().includes(search);
    const matchType = !typeF || c.competition_type === typeF;
    return matchText && matchType;
  });

  // KPI Summary
  const kpiEl = document.getElementById('comp-kpi');
  const allAssess = DB.assessments || [];
  const execAll = allAssess.filter(a => a.type === 'EXECUTION');
  const artAll  = allAssess.filter(a => a.type === 'ARTISTIC');
  const execOk  = execAll.filter(a => a.accuracy !== 'bad');
  const artOk   = artAll.filter(a => a.accuracy !== 'bad');

  kpiEl.innerHTML = `
    ${kpiCard('Соревнований', DB.competitions.length, '#155DFC', iconTrophy())}
    ${kpiCard('Судей', DB.referees.length, '#60A5FA', iconUser())}
    ${kpiCard('Выступлений', DB.performances.length, '#10B981', iconStar())}
    ${kpiCard('Точность исполнения', execAll.length ? pct(100 * execOk.length / execAll.length) : '—', '#F59E0B', iconTarget())}
  `;

  if (!comps.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="tbl-empty">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div>Соревнования не найдены</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = comps.map(c => `
    <tr onclick="openCompDetail('${escHtml(c.competition)}')">
      <td><span style="font-weight:700;color:var(--text-primary)">${escHtml(c.competition)}</span></td>
      <td>${compTypeBadge(c.competition_type)}</td>
      <td style="font-variant-numeric:tabular-nums;font-weight:600">${c.perf_count}</td>
      <td style="font-variant-numeric:tabular-nums;font-weight:600">${c.ref_count}</td>
      <td>${accBar(null, c.exec_ok_pct, c.exec_ok_pct == null ? null : 100 - c.exec_ok_pct)}</td>
      <td>${accBar(null, c.art_ok_pct, c.art_ok_pct == null ? null : 100 - c.art_ok_pct)}</td>
      <td><span class="dev-value ${devClass(c.avg_deviation)}">${num(c.avg_deviation, 3)}</span></td>
    </tr>
  `).join('');
}

function devClass(dev) {
  if (dev == null) return '';
  if (dev <= 0.15) return 'dev-ok';
  if (dev <= 0.30) return 'dev-warn';
  return 'dev-bad';
}

/* ══════════════════════════════════
   PAGE: COMPETITION DETAIL
══════════════════════════════════ */
function openCompDetail(compName) {
  cdComp = compName;
  cdDisc = null;
  cdAge  = null;

  const comp = DB.competitions.find(c => c.competition === compName);
  document.getElementById('cd-title').textContent = compName;
  document.getElementById('cd-sub').textContent = comp
    ? `${comp.competition_type === 'RUSSIA' ? 'Всероссийские' : 'Региональные'} · ${comp.perf_count} выступлений · ${comp.ref_count} судей`
    : '';

  // KPI
  const cg = DB.assessments.filter(a => a.competition === compName);
  const eg = cg.filter(a => a.type === 'EXECUTION');
  const ag = cg.filter(a => a.type === 'ARTISTIC');
  const execOkPct = eg.length ? 100 * eg.filter(a => a.accuracy !== 'bad').length / eg.length : null;
  const artOkPct  = ag.length ? 100 * ag.filter(a => a.accuracy !== 'bad').length / ag.length : null;
  const avgDev    = cg.length ? cg.reduce((s, a) => s + a.deviation, 0) / cg.length : null;

  document.getElementById('cd-kpi').innerHTML = `
    ${kpiCard('Оценок всего', cg.length, '#155DFC', iconTarget())}
    ${kpiCard('Исполнение (допуст.)', execOkPct != null ? pct(execOkPct) : '—', '#10B981', iconStar())}
    ${kpiCard('Артистизм (допуст.)', artOkPct != null ? pct(artOkPct) : '—', '#60A5FA', iconStar())}
    ${kpiCard('Ср. отклонение', avgDev != null ? num(avgDev, 3) : '—', '#F59E0B', iconChart())}
  `;

  // Chips
  const detail = DB.comp_detail[compName] || {};
  const discs = Object.keys(detail).sort();
  const ages  = [...new Set(Object.values(detail).flatMap(d => Object.keys(d)))].sort();

  document.getElementById('cd-disc-chips').innerHTML =
    discs.map(d => `<div class="chip${cdDisc === d ? ' on' : ''}" onclick="toggleDisc('${escHtml(d)}')">${escHtml(d)}</div>`).join('');
  document.getElementById('cd-age-chips').innerHTML =
    ages.map(a => `<div class="chip${cdAge === a ? ' on' : ''}" onclick="toggleAge('${escHtml(a)}')">${escHtml(a)}</div>`).join('');

  renderCatTable();
  nav('comp-detail');
}

function toggleDisc(d) { cdDisc = cdDisc === d ? null : d; openCompDetailRefresh(); }
function toggleAge(a)  { cdAge  = cdAge  === a ? null : a; openCompDetailRefresh(); }
function openCompDetailRefresh() { openCompDetail(cdComp); }

function renderCatTable() {
  const detail = DB.comp_detail[cdComp] || {};
  const tbody  = document.getElementById('cd-tbody');
  let rows = [];

  for (const disc of Object.keys(detail).sort()) {
    if (cdDisc && disc !== cdDisc) continue;
    for (const age of Object.keys(detail[disc]).sort()) {
      if (cdAge && age !== cdAge) continue;
      const d = detail[disc][age];
      rows.push({ disc, age, exec: d.exec, art: d.art });
    }
  }

  document.getElementById('cd-cat-count').textContent = rows.length + ' категорий';

  tbody.innerHTML = rows.map(r => {
    const ex = r.exec, ar = r.art;
    const execOk = ex ? ex.bullseye + ex.ok : null;
    return `<tr onclick="openCat('${escHtml(cdComp)}','${escHtml(r.disc)}','${escHtml(r.age)}')">
      <td>
        <span style="font-weight:700;color:var(--text-primary)">${escHtml(r.age)}</span>
        <span class="badge b-blue" style="margin-left:6px">${escHtml(r.disc)}</span>
      </td>
      <td style="font-variant-numeric:tabular-nums;font-weight:600">${ex ? ex.count : '—'}</td>
      <td>${ex ? pctCell(ex.bullseye, 'green') : '—'}</td>
      <td>${ex ? pctCell(ex.ok, 'yellow') : '—'}</td>
      <td>${ex ? pctCell(ex.bad, 'red') : '—'}</td>
      <td>${ar ? pctCell(ar.bullseye + ar.ok, ar.bullseye + ar.ok >= 70 ? 'green' : ar.bullseye + ar.ok >= 50 ? 'yellow' : 'red') : '—'}</td>
      <td><span class="dev-value ${devClass(ex?.avg_dev)}">${ex ? num(ex.avg_dev, 3) : '—'}</span></td>
      <td>
        <button class="btn-heatmap" onclick="event.stopPropagation();openCat('${escHtml(cdComp)}','${escHtml(r.disc)}','${escHtml(r.age)}')">
          🔥 Карта
        </button>
      </td>
    </tr>`;
  }).join('');

  // inline style for heatmap btn
  document.querySelectorAll('.btn-heatmap').forEach(b => {
    b.style.cssText = 'font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--primary-soft);color:var(--primary);cursor:pointer;font-family:inherit;transition:all .15s';
    b.onmouseenter = () => b.style.background = 'var(--primary)' && (b.style.color = '#fff');
    b.onmouseleave = () => { b.style.background = 'var(--primary-soft)'; b.style.color = 'var(--primary)'; };
  });
}

function pctCell(val, color) {
  const colors = { green: '#10B981', yellow: '#B45309', red: '#EF4444' };
  const bgs    = { green: 'var(--green-soft)', yellow: 'var(--yellow-soft)', red: 'var(--red-soft)' };
  if (val == null) return '—';
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${bgs[color]};color:${colors[color]};font-weight:700;font-size:12px">${pct(val)}</span>`;
}

/* ══════════════════════════════════
   PAGE: CATEGORY / HEATMAP
══════════════════════════════════ */
function openCat(comp, disc, age) {
  document.getElementById('cat-title').textContent = `${age} · ${disc}`;
  document.getElementById('cat-sub').textContent = comp;

  const cg = DB.assessments.filter(a =>
    a.competition === comp && a.discipline === disc && a.age_category === age
  );

  // Heatmap: referee × region
  const refs   = [...new Set(cg.map(a => a.referee_id))];
  const regions= [...new Set(cg.map(a => a.perf_region))].sort();

  let hmHTML = `<table class="hm-table"><thead><tr><th>Судья</th>${regions.map(r => `<th>${escHtml(r)}</th>`).join('')}</tr></thead><tbody>`;
  for (const rid of refs) {
    const refName = DB.referees.find(r => r.id === rid)?.fio || rid;
    const rg = cg.filter(a => a.referee_id === rid);
    hmHTML += `<tr><td class="hm-name-cell">${escHtml(refName)}</td>`;
    for (const reg of regions) {
      const rg2 = rg.filter(a => a.perf_region === reg);
      if (!rg2.length) { hmHTML += `<td></td>`; continue; }
      const avgDev = rg2.reduce((s, a) => s + a.deviation, 0) / rg2.length;
      const { bg, fg } = heatColor(avgDev);
      hmHTML += `<td><span class="hm-cell" style="background:${bg};color:${fg}">${num(avgDev, 3)}</span></td>`;
    }
    hmHTML += `</tr>`;
  }
  hmHTML += `</tbody></table>`;
  document.getElementById('cat-heatmap').innerHTML = hmHTML;

  // Bar chart: avg score per referee
  const refData = refs.map(rid => {
    const rg  = cg.filter(a => a.referee_id === rid);
    const avg = rg.length ? rg.reduce((s, a) => s + a.score, 0) / rg.length : 0;
    const name = DB.referees.find(r => r.id === rid)?.fio || rid;
    return { name: name.split(' ').slice(0, 2).join(' '), avg };
  });

  if (charts['cat-bar']) charts['cat-bar'].destroy();
  const ctx = document.getElementById('cat-bar-chart').getContext('2d');
  charts['cat-bar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: refData.map(r => r.name),
      datasets: [{
        label: 'Средняя оценка',
        data: refData.map(r => +r.avg.toFixed(3)),
        backgroundColor: 'rgba(21,93,252,0.15)',
        borderColor: '#155DFC',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(21,93,252,0.07)' }, ticks: { color: '#8BA3C0', font: { family: 'Nunito Sans', weight: '700' } } },
        x: { grid: { display: false }, ticks: { color: '#8BA3C0', font: { family: 'Nunito Sans', weight: '700', size: 11 } } }
      }
    }
  });

  // Detail table
  const tbody = document.getElementById('cat-tbody');
  tbody.innerHTML = refs.map((rid, i) => {
    const rg   = cg.filter(a => a.referee_id === rid);
    const name = DB.referees.find(r => r.id === rid)?.fio || rid;
    const reg  = DB.referees.find(r => r.id === rid)?.region || '—';
    const execG = rg.filter(a => a.type === 'EXECUTION');
    const artG  = rg.filter(a => a.type === 'ARTISTIC');
    const avgScore = rg.length ? rg.reduce((s, a) => s + a.score, 0) / rg.length : null;
    const avgDev   = rg.length ? rg.reduce((s, a) => s + a.deviation, 0) / rg.length : null;
    const types = [...new Set(rg.map(a => a.type))].join(', ');
    return `<tr onclick="openRefProfile('${rid}')">
      <td style="font-weight:700;color:var(--text-muted)">${i + 1}</td>
      <td style="font-weight:700">${escHtml(name)}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(reg)}</td>
      <td><span class="badge b-blue">${types}</span></td>
      <td><span class="dev-value">${fn(avgScore)}</span></td>
      <td><span class="dev-value ${devClass(avgDev)}">${num(avgDev, 3)}</span></td>
      <td>${pctCell(rg.filter(a => a.accuracy === 'bullseye').length / rg.length * 100, 'green')}</td>
      <td>${pctCell(rg.filter(a => a.accuracy === 'ok').length / rg.length * 100, 'yellow')}</td>
      <td>${pctCell(rg.filter(a => a.accuracy === 'bad').length / rg.length * 100, 'red')}</td>
    </tr>`;
  }).join('');

  nav('cat');
}

function heatColor(dev) {
  if (dev <= 0.1) return { bg: 'rgba(16,185,129,0.15)', fg: '#065F46' };
  if (dev <= 0.2) return { bg: 'rgba(245,158,11,0.15)', fg: '#92400E' };
  if (dev <= 0.35)return { bg: 'rgba(239,68,68,0.15)',  fg: '#991B1B' };
  return             { bg: 'rgba(239,68,68,0.28)',  fg: '#7F1D1D' };
}

/* ══════════════════════════════════
   PAGE: REFEREES
══════════════════════════════════ */
function renderRefs() {
  if (!DB) return;
  const tbody = document.getElementById('ref-tbody');
  const search = (document.getElementById('ref-search')?.value || '').toLowerCase();
  const sortBy = document.getElementById('ref-sort')?.value || 'fio';

  let refs = DB.referees.filter(r =>
    !search || r.fio.toLowerCase().includes(search) || (r.region || '').toLowerCase().includes(search)
  );

  refs.sort((a, b) => {
    if (sortBy === 'fio')      return a.fio.localeCompare(b.fio, 'ru');
    if (sortBy === 'exec_bad') return (b.exec_bad || 0) - (a.exec_bad || 0);
    if (sortBy === 'art_bad')  return (b.art_bad || 0) - (a.art_bad || 0);
    if (sortBy === 'bias')     return (Math.abs(b.bias) || 0) - (Math.abs(a.bias) || 0);
    if (sortBy === 'total')    return (b.total || 0) - (a.total || 0);
    return 0;
  });

  tbody.innerHTML = refs.map(r => {
    const execOk = (r.exec_bullseye || 0) + (r.exec_ok || 0);
    const artOk  = (r.art_bullseye  || 0) + (r.art_ok  || 0);
    const biasVal = r.bias;
    const biasColor2 = biasColor(biasVal);
    return `<tr onclick="openRefProfile('${r.id}')">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#155DFC,#60A5FA);display:flex;align-items:center;justify-content:center;font-family:Lexend;font-weight:800;font-size:12px;color:#fff;flex-shrink:0">${initials(r.fio)}</div>
          <span style="font-weight:700">${escHtml(r.fio)}</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(r.region || '—')}<br><span style="color:var(--text-muted)">${escHtml(r.city || '')}</span></td>
      <td style="font-variant-numeric:tabular-nums;font-weight:600">${r.total}</td>
      <td>${accBar(r.exec_bullseye, r.exec_ok, r.exec_bad)}</td>
      <td>${accBar(r.art_bullseye, r.art_ok, r.art_bad)}</td>
      <td>
        ${biasVal != null
          ? `<span style="font-family:Lexend;font-weight:700;color:${biasColor2}">${biasVal > 0 ? '+' : ''}${num(biasVal, 3)}</span>`
          : '<span style="color:var(--text-muted)">—</span>'}
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════
   PAGE: REFEREE PROFILE
══════════════════════════════════ */
function openRefProfile(refId) {
  const r = DB.referees.find(x => x.id == refId || x.id === refId);
  if (!r) return;
  rpRef = r;
  rpTabMode = 'exec';

  document.getElementById('rp-name').textContent = r.fio;
  document.getElementById('rp-sub').textContent  = [r.region, r.city].filter(Boolean).join(' · ');
  document.getElementById('rp-hero-name').textContent = r.fio;
  document.getElementById('rp-hero-meta').textContent = [r.region, r.city].filter(Boolean).join(', ') || '—';
  document.getElementById('rp-avatar').textContent = initials(r.fio);

  // Gauges
  const execOk = (r.exec_bullseye || 0) + (r.exec_ok || 0);
  const artOk  = (r.art_bullseye  || 0) + (r.art_ok  || 0);
  document.getElementById('rp-gauges').innerHTML =
    gaugeRing(execOk, 'Исполнение', '#10B981') +
    gaugeRing(artOk,  'Артистизм',  '#60A5FA') +
    (r.bias != null ? gaugeRing(Math.min(100, Math.abs(r.bias) * 200), 'Предвзят.', biasColor(r.bias)) : '');

  // KPI stats
  document.getElementById('rp-stats').innerHTML = `
    ${kpiCard('Оценок исп.', r.exec_total, '#155DFC', iconTarget())}
    ${kpiCard('Оценок арт.', r.art_total, '#60A5FA', iconStar())}
    ${kpiCard('В яблочко (исп.)', pct(r.exec_bullseye), '#10B981', iconCheck())}
    ${kpiCard('Предвзятость', r.bias != null ? num(r.bias, 3) : '—', biasColor(r.bias), iconChart())}
  `;

  // Accuracy chart
  if (charts['rp-acc']) charts['rp-acc'].destroy();
  const ctx = document.getElementById('rp-acc-chart').getContext('2d');
  charts['rp-acc'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['В яблочко', 'Допустимо', 'Серьёзное'],
      datasets: [{
        data: [r.exec_bullseye || 0, r.exec_ok || 0, r.exec_bad || 0],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'],
        borderWidth: 0,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#4B6080', font: { family: 'Nunito Sans', weight: '700', size: 12 }, padding: 16 }
        }
      }
    }
  });

  // Bias detail
  const biasEl = document.getElementById('rp-bias-detail');
  if (r.bias != null) {
    const absB = Math.abs(r.bias);
    const fillPct = Math.min(50, absB * 100);
    const side = r.bias >= 0 ? 'right' : 'left';
    const col  = biasColor(r.bias);
    biasEl.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">
          Коэффициент предвзятости: <span style="font-family:Lexend;font-size:18px;font-weight:800;color:${col}">${r.bias > 0 ? '+' : ''}${num(r.bias, 3)}</span>
        </div>
        <div class="bias-meter">
          <div class="bias-center"></div>
          <div class="bias-fill" style="width:${fillPct}%;${side}:50%;background:${col}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:4px;font-weight:700">
          <span>← Занижает своих</span><span>Завышает своих →</span>
        </div>
      </div>
      <div class="bias-cards">
        <div class="bias-card">
          <div class="bias-card-label">Свой регион — ср. откл.</div>
          <div class="bias-card-val">${r.bias_own_mean != null ? num(r.bias_own_mean, 4) : '—'}</div>
        </div>
        <div class="bias-card">
          <div class="bias-card-label">Чужие регионы — ср. откл.</div>
          <div class="bias-card-val">${r.bias_foreign_mean != null ? num(r.bias_foreign_mean, 4) : '—'}</div>
        </div>
      </div>`;
  } else {
    biasEl.innerHTML = '<div style="color:var(--text-muted);font-weight:600;padding:20px 0;text-align:center">Недостаточно данных для расчёта предвзятости</div>';
  }

  // Tab reset
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'exec'));

  // Fill selects
  const pa = DB.assessments.filter(a => a.referee_id == r.id);
  fillSelect('rp-filter-disc', [...new Set(pa.map(a => a.discipline))]);
  fillSelect('rp-filter-age',  [...new Set(pa.map(a => a.age_category))]);
  fillSelect('rp-filter-comp', [...new Set(pa.map(a => a.competition))]);

  renderProfilePerfs();
  nav('ref-profile');
}

function fillSelect(id, vals) {
  const el = document.getElementById(id);
  const cur = el.value;
  el.innerHTML = `<option value="">Все</option>` +
    vals.sort().map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('');
  if (vals.includes(cur)) el.value = cur;
}

function rpTab(mode) {
  rpTabMode = mode;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
  renderProfilePerfs();
}

function renderProfilePerfs() {
  if (!rpRef) return;
  const r    = rpRef;
  const type = rpTabMode === 'exec' ? 'EXECUTION' : 'ARTISTIC';
  const discF = document.getElementById('rp-filter-disc')?.value || '';
  const ageF  = document.getElementById('rp-filter-age')?.value || '';
  const compF = document.getElementById('rp-filter-comp')?.value || '';

  const perfs = DB.assessments.filter(a =>
    a.referee_id == r.id && a.type === type &&
    (!discF || a.discipline === discF) &&
    (!ageF  || a.age_category === ageF) &&
    (!compF || a.competition === compF)
  );

  document.getElementById('rp-perf-count').textContent = perfs.length + ' выступлений';

  document.getElementById('rp-tbody').innerHTML = perfs.map(a => {
    const others = DB.assessments
      .filter(x => x.performance_id === a.performance_id && x.type === a.type && x.referee_id != r.id)
      .map(x => x.score);
    const col = a.accuracy === 'bullseye' ? 'rgba(16,185,129,0.18)' :
                a.accuracy === 'ok'       ? 'rgba(245,158,11,0.15)' :
                                            'rgba(239,68,68,0.15)';
    const tc  = a.accuracy === 'bullseye' ? '#065F46' :
                a.accuracy === 'ok'       ? '#B45309' : '#991B1B';
    return `<tr>
      <td style="font-size:12px;font-weight:600">${escHtml(a.competition)}</td>
      <td><span class="badge b-blue">${escHtml(a.discipline)}</span></td>
      <td style="font-size:12px">${escHtml(a.age_category)}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${escHtml(a.perf_region || '—')}</td>
      <td><span class="score-badge" style="background:${col};color:${tc}">${a.score.toFixed(2)}</span></td>
      <td><div class="other-scores">${others.map(s => `<span class="os">${s.toFixed(2)}</span>`).join('')}</div></td>
      <td style="font-variant-numeric:tabular-nums;font-weight:700">${a.result_type.toFixed(2)}</td>
      <td class="dev-value ${devClass(a.deviation)}" style="font-variant-numeric:tabular-nums">${a.deviation.toFixed(3)}</td>
      <td>${accBadge(a.accuracy)}</td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════
   KPI CARD HELPER
══════════════════════════════════ */


/* ── Icons ── */
/* ── Яркие иконки с градиентами ── */
function iconTrophy() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4" stroke="#FFD700" stroke-width="3" fill="none"/>
    <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" stroke="#FFD700" stroke-width="3" fill="none"/>
    <path d="M12 17v4" stroke="#FFA500" stroke-width="3" fill="none"/>
    <path d="M8 21h8" stroke="#FFA500" stroke-width="3" fill="none"/>
    <path d="M6 5v4a6 6 0 0 0 12 0V5H6Z" stroke="#FFD700" stroke-width="3" fill="#FFD700"/>
  </svg>`; 
}

function iconUser() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <circle cx="12" cy="8" r="4" stroke="#00D4FF" stroke-width="3" fill="#00D4FF"/>
    <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#00D4FF" stroke-width="3" fill="#00D4FF"/>
  </svg>`; 
}

function iconStar() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      stroke="#44ff57" stroke-width="2" fill="#44ff57"/>
  </svg>`; 
}

function iconTarget() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <circle cx="12" cy="12" r="10" stroke="#ff9d00" stroke-width="3" fill="#ff9d00"/>
    <circle cx="12" cy="12" r="6" stroke="#ffffff" stroke-width="2" fill="none"/>
    <circle cx="12" cy="12" r="2" fill="#ffffff"/>
  </svg>`; 
}

function iconChart() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <rect x="17" y="9" width="3" height="11" rx="1" fill="#B74CFF"/>
    <rect x="10" y="4" width="3" height="16" rx="1" fill="#D96CFF"/>
    <rect x="3" y="13" width="3" height="7" rx="1" fill="#9B30FF"/>
  </svg>`; 
}

function iconCheck() { 
  return `<svg width="28" height="28" viewBox="0 0 24 24" style="display:block;">
    <circle cx="12" cy="12" r="11" stroke="#ffd500" stroke-width="3" fill="none"/>
    <path d="M7 12l4 4 7-8" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`; 
}

/* Обновлённая KPI карточка с эффектами для иконок */
function kpiCard(label, value, color, iconSvg) {
  return `
    <div class="kpi-card" style="--kpi-color:${color}">
      <div style="margin-bottom:12px;">  <!-- Убрали класс kpi-icon -->
        ${iconSvg}  <!-- Иконка без обёртки с opacity -->
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;
}
/* ── Escape HTML ── */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════
   CSV UPLOAD
══════════════════════════════════ */
function loadCSV(key, input) {
  const file = input.files[0];
  if (!file) return;
  const stId = key === 'ref' ? 'st-ref' : key === 'perf' ? 'st-perf' : 'st-assess';
  document.getElementById(stId).innerHTML = '<span class="status-loading">⏳ Загрузка...</span>';

  Papa.parse(file, {
    header: false, skipEmptyLines: true, dynamicTyping: true,
    complete(r) {
      csvBuf[key] = r.data;
      document.getElementById(stId).innerHTML =
        `<span class="status-ok">✅ Загружено ${r.data.length} строк</span>`;
      // Mark upload zone
      const uz = document.getElementById('uz-' + key);
      if (uz) {
        uz.style.borderColor = 'var(--green)';
        uz.style.background  = 'rgba(16,185,129,0.06)';
      }
    },
    error(e) {
      document.getElementById(stId).innerHTML =
        `<span class="status-err">❌ ${e.message}</span>`;
    }
  });
}

function rebuildFromCSV() {
  const st = document.getElementById('st-rebuild');
  if (!csvBuf.ref || !csvBuf.perf || !csvBuf.assess) {
    st.innerHTML = '<span class="status-err">⚠️ Загрузите все три файла</span>';
    return;
  }
  st.innerHTML = '<span class="status-loading">⏳ Пересчёт данных...</span>';
  showLoading(true);

  setTimeout(() => {
    try {
      const refs  = csvBuf.ref.map(r => ({ id: r[0], fio: r[1], region: r[2], city: r[3] }));
      const perfs = csvBuf.perf.map(p => ({
        id: p[0], region: p[1], city: p[2], competition_type: p[3],
        competition: p[4], age_category: p[5], discipline: p[6]
      }));
      const ass = csvBuf.assess.map(a => ({
        id: a[0], referee_id: a[1], performance_id: a[2], type: a[3],
        number: a[4], referee_assessment: a[5],
        result_type_assessment: a[6], result_assessment: a[7]
      }));
      DB = buildDB(refs, perfs, ass);
      renderComps();
      renderRefs();
      updateDataStatus();
      showLoading(false);
      st.innerHTML = '<span class="status-ok">✅ Готово! Данные обновлены.</span>';
    } catch(e) {
      showLoading(false);
      st.innerHTML = `<span class="status-err">❌ Ошибка: ${e.message}</span>`;
    }
  }, 100);
}

function showLoading(show) {
  document.getElementById('loading-overlay')?.classList.toggle('visible', show);
}

/* ══════════════════════════════════
   BUILD DB FROM RAW CSV
══════════════════════════════════ */
function allowedDev(s) { return s >= 8 ? 0.3 : s >= 7 ? 0.4 : s >= 6 ? 0.5 : 0.6; }
function accLbl(dev, s) {
  if (dev === 0) return 'bullseye';
  if (dev <= allowedDev(s)) return 'ok';
  return 'bad';
}

function buildDB(refs, perfs, assRows) {
  const refMap  = Object.fromEntries(refs.map(r  => [r.id,  r]));
  const perfMap = Object.fromEntries(perfs.map(p => [p.id,  p]));

  const assessments = assRows.map(a => {
    const p   = perfMap[a.performance_id] || {};
    const ref = refMap[a.referee_id]      || {};
    const dev = Math.abs(a.referee_assessment - a.result_type_assessment);
    return {
      ...a,
      competition:      p.competition,
      competition_type: p.competition_type,
      discipline:       p.discipline,
      age_category:     p.age_category,
      perf_region:      p.region,
      ref_region:       ref.region,
      deviation:        +dev.toFixed(4),
      accuracy:         accLbl(dev, a.result_type_assessment),
      score:            a.referee_assessment,
      result_type:      a.result_type_assessment,
      result_total:     a.result_assessment,
    };
  });

  const refData = refs.map(r => {
    const rg      = assessments.filter(a => a.referee_id == r.id);
    const own     = rg.filter(a => a.perf_region === r.region);
    const foreign = rg.filter(a => a.perf_region !== r.region);
    const bias    = (own.length > 0 && foreign.length > 0)
      ? +(foreign.reduce((s, a) => s + a.deviation, 0) / foreign.length -
          own.reduce(    (s, a) => s + a.deviation, 0) / own.length    ).toFixed(4)
      : null;
    const eg = rg.filter(a => a.type === 'EXECUTION');
    const ag = rg.filter(a => a.type === 'ARTISTIC');
    const ap = (g, l) => g.length ? +(100 * g.filter(a => a.accuracy === l).length / g.length).toFixed(1) : 0;
    return {
      id: r.id, fio: r.fio, region: r.region, city: r.city,
      total: rg.length,
      exec_bullseye: ap(eg, 'bullseye'), exec_ok: ap(eg, 'ok'), exec_bad: ap(eg, 'bad'),
      art_bullseye:  ap(ag, 'bullseye'), art_ok:  ap(ag, 'ok'), art_bad:  ap(ag, 'bad'),
      exec_total: eg.length, art_total: ag.length,
      bias,
      bias_own_mean:     own.length     ? +(own.reduce(    (s, a) => s + a.deviation, 0) / own.length    ).toFixed(4) : null,
      bias_foreign_mean: foreign.length ? +(foreign.reduce((s, a) => s + a.deviation, 0) / foreign.length).toFixed(4) : null,
    };
  });

  const compNames = [...new Set(assessments.map(a => a.competition).filter(Boolean))];
  const competitions = compNames.map(comp => {
    const cg = assessments.filter(a => a.competition === comp);
    const eg = cg.filter(a => a.type === 'EXECUTION');
    const ag = cg.filter(a => a.type === 'ARTISTIC');
    const okp = g => g.length ? +(100 * g.filter(a => a.accuracy !== 'bad').length / g.length).toFixed(1) : null;
    return {
      competition:      comp,
      competition_type: cg[0]?.competition_type,
      perf_count:       [...new Set(cg.map(a => a.performance_id))].length,
      ref_count:        [...new Set(cg.map(a => a.referee_id))].length,
      exec_ok_pct:      okp(eg),
      art_ok_pct:       okp(ag),
      avg_deviation:    +(cg.reduce((s, a) => s + a.deviation, 0) / cg.length).toFixed(4),
    };
  });

  const comp_detail = {};
  for (const comp of compNames) {
    comp_detail[comp] = {};
    const cg = assessments.filter(a => a.competition === comp);
    for (const disc of [...new Set(cg.map(a => a.discipline))]) {
      comp_detail[comp][disc] = {};
      const dg = cg.filter(a => a.discipline === disc);
      for (const age of [...new Set(dg.map(a => a.age_category))]) {
        const ag2  = dg.filter(a => a.age_category === age);
        const eg2  = ag2.filter(a => a.type === 'EXECUTION');
        const arg  = ag2.filter(a => a.type === 'ARTISTIC');
        const stat = g => g.length ? {
          bullseye: +(100 * g.filter(a => a.accuracy === 'bullseye').length / g.length).toFixed(1),
          ok:       +(100 * g.filter(a => a.accuracy === 'ok'      ).length / g.length).toFixed(1),
          bad:      +(100 * g.filter(a => a.accuracy === 'bad'     ).length / g.length).toFixed(1),
          avg_dev:  +(g.reduce((s, a) => s + a.deviation, 0) / g.length).toFixed(4),
          count:    g.length,
        } : null;
        comp_detail[comp][disc][age] = { exec: stat(eg2), art: stat(arg) };
      }
    }
  }

  return { referees: refData, performances: perfs, assessments, competitions, comp_detail };
}

/* ══════════════════════════════════
   BOOT
══════════════════════════════════ */
async function boot() {
  showLoading(true);
  try {
    const resp = await fetch('bundle.json');
    if (!resp.ok) throw new Error('bundle.json not found');
    const raw = await resp.json();
    const lm = { bullseye: 'bullseye', ok: 'ok', bad: 'bad', 'В яблочко': 'bullseye', 'Допустимое': 'ok', 'Серьёзное': 'bad' };
    raw.assessments.forEach(a => { a.accuracy = lm[a.accuracy] || a.accuracy; });
    DB = raw;
    renderComps();
    renderRefs();
    updateDataStatus();
  } catch(e) {
    console.warn('bundle.json not found — ready for CSV upload');
    document.getElementById('comp-tbody').innerHTML = `
      <tr><td colspan="7" class="tbl-empty">
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div>Данные не загружены</div>
          <a class="empty-link" href="#" onclick="nav('upload')">Загрузить CSV-файлы →</a>
        </div>
      </td></tr>`;
  }
  showLoading(false);
}

boot();
