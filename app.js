/* Portafoglio — tracker investimenti ETF / Azioni / Crypto
 * 100% client-side. Dati in localStorage.
 * Prezzi: crypto via CoinGecko, azioni/ETF via Stooq.
 * Non è consulenza finanziaria.
 */
"use strict";

const STORE_KEY = "portafoglio.holdings.v1";
const TARGET_KEY = "portafoglio.targets.v1";
const HISTORY_KEY = "portafoglio.history.v1";
const CLASSES = ["ETF", "Azioni", "Crypto", "Obbligazioni", "Liquidità"];
const CLASS_COLORS = {
  ETF: "#5b8cff", Azioni: "#7c5bff", Crypto: "#ffb15b",
  Obbligazioni: "#2ecc71", "Liquidità": "#8b95a7",
};
// Classi che supportano prezzo live e tramite quale fonte
const LIVE = {
  Crypto: { source: "coingecko", label: "ID CoinGecko (prezzo live)", hint: "es. bitcoin, ethereum, solana — prezzo in EUR" },
  ETF: { source: "stooq", label: "Ticker Stooq (prezzo live)", hint: "es. vwce.de, csspx.uk — usa la borsa in EUR per evitare conversioni" },
  Azioni: { source: "stooq", label: "Ticker Stooq (prezzo live)", hint: "es. aapl.us, enel.it — il prezzo è nella valuta della borsa" },
};

const euro = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);
const pct = (n) => `${n >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- State ---------- */
let holdings = load(STORE_KEY, []).map(migrate);
let targets = load(TARGET_KEY, { ETF: 50, Azioni: 20, Crypto: 10, Obbligazioni: 15, "Liquidità": 5 });
let history = load(HISTORY_KEY, []);
let charts = {};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(holdings));
  localStorage.setItem(TARGET_KEY, JSON.stringify(targets));
}
function saveHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }

// Migrazione vecchio campo coinId -> symbol
function migrate(h) {
  if (h.symbol == null && h.coinId != null) h.symbol = h.coinId;
  if (h.symbol == null) h.symbol = "";
  return h;
}

/* ---------- Derived helpers ---------- */
const priceOf = (h) => (h.now != null && h.now !== "" ? +h.now : +h.avg);
const valueOf = (h) => priceOf(h) * +h.qty;
const costOf = (h) => +h.avg * +h.qty;
const totalValue = () => holdings.reduce((s, h) => s + valueOf(h), 0);
const totalCost = () => holdings.reduce((s, h) => s + costOf(h), 0);

function valueByClass() {
  const map = {};
  for (const h of holdings) map[h.cls] = (map[h.cls] || 0) + valueOf(h);
  return map;
}

/* ============ NAVIGATION ============ */
document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  const view = btn.dataset.view;
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "dashboard") renderDashboard();
  if (view === "pac") renderPac();
});

/* ============ HOLDINGS FORM ============ */
const form = document.getElementById("holdingForm");
const classSel = document.getElementById("hClass");

function updateSymbolField() {
  const cfg = LIVE[classSel.value];
  const field = document.querySelector(".symbol-field");
  field.hidden = !cfg;
  if (cfg) {
    document.getElementById("symbolLabel").textContent = cfg.label;
    document.getElementById("symbolHint").textContent = cfg.hint;
    document.getElementById("hSymbol").placeholder = cfg.source === "stooq" ? "es. aapl.us" : "es. bitcoin";
  }
}
classSel.addEventListener("change", updateSymbolField);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const h = {
    id: uid(),
    name: document.getElementById("hName").value.trim(),
    cls: classSel.value,
    symbol: document.getElementById("hSymbol").value.trim().toLowerCase(),
    qty: +document.getElementById("hQty").value,
    avg: +document.getElementById("hAvg").value,
    now: document.getElementById("hNow").value === "" ? null : +document.getElementById("hNow").value,
  };
  if (!h.name || !(h.qty > 0)) return;
  holdings.push(h);
  save();
  form.reset();
  updateSymbolField();
  renderHoldings();
  if (h.symbol) refreshPrices();
});

/* ============ HOLDINGS TABLE ============ */
function renderHoldings() {
  const body = document.getElementById("holdingsBody");
  const empty = document.getElementById("emptyHint");
  body.innerHTML = "";
  empty.hidden = holdings.length > 0;

  for (const h of holdings) {
    const val = valueOf(h);
    const pnl = val - costOf(h);
    const pnlPct = costOf(h) > 0 ? (pnl / costOf(h)) * 100 : 0;
    const cls = pnl >= 0 ? "pos" : "neg";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${esc(h.name)}</strong>${h.symbol ? `<br><span class="muted">${esc(h.symbol)}</span>` : ""}</td>
      <td><span class="badge">${h.cls}</span></td>
      <td class="num">${fmtNum(h.qty)}</td>
      <td class="num">${euro(h.avg)}</td>
      <td class="num">${euro(priceOf(h))}</td>
      <td class="num"><strong>${euro(val)}</strong></td>
      <td class="num ${cls}">${euro(pnl)}<br><span class="muted">${pct(pnlPct)}</span></td>
      <td class="num"><button class="btn danger" data-del="${h.id}" title="Rimuovi">✕</button></td>`;
    body.appendChild(tr);
  }
}

document.getElementById("holdingsBody").addEventListener("click", (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (!id) return;
  holdings = holdings.filter((h) => h.id !== id);
  save();
  renderHoldings();
});

/* ============ DASHBOARD ============ */
function renderDashboard() {
  const val = totalValue();
  const cost = totalCost();
  const pnl = val - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  document.getElementById("kpiTotal").textContent = euro(val);
  document.getElementById("kpiInvested").textContent = `investito ${euro(cost)}`;
  const pnlEl = document.getElementById("kpiPnl");
  pnlEl.textContent = euro(pnl);
  pnlEl.className = `kpi-value ${pnl >= 0 ? "pos" : "neg"}`;
  document.getElementById("kpiPnlPct").textContent = pct(pnlPct);
  document.getElementById("kpiCount").textContent = holdings.length;
  const classes = [...new Set(holdings.map((h) => h.cls))];
  document.getElementById("kpiClasses").textContent = classes.join(" · ") || "—";

  renderHistoryChart();
  renderAllocChart();
  renderTopChart();
  renderRebalance();
}

function renderAllocChart() {
  const byClass = valueByClass();
  const labels = Object.keys(byClass);
  const data = Object.values(byClass);
  drawDoughnut("allocChart", labels, data, labels.map((l) => CLASS_COLORS[l] || "#5b8cff"));
}

function renderTopChart() {
  const top = [...holdings].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 6);
  drawBar("topChart", top.map((h) => h.name), top.map(valueOf), top.map((h) => CLASS_COLORS[h.cls] || "#5b8cff"));
}

function renderRebalance() {
  const wrap = document.getElementById("rebalance");
  wrap.innerHTML = "";
  const val = totalValue();
  const byClass = valueByClass();

  for (const cls of CLASSES) {
    const current = byClass[cls] || 0;
    const curPct = val > 0 ? (current / val) * 100 : 0;
    const tgt = targets[cls] ?? 0;
    const targetVal = (tgt / 100) * val;
    const delta = targetVal - current;
    const action = Math.abs(delta) < 1 ? "in linea ✓"
      : delta > 0 ? `compra ${euro(delta)}` : `vendi ${euro(-delta)}`;
    const actionCls = Math.abs(delta) < 1 ? "muted" : delta > 0 ? "pos" : "neg";

    const row = document.createElement("div");
    row.className = "reb-row";
    row.innerHTML = `
      <span><span class="badge">${cls}</span></span>
      <div class="bar"><i style="width:${Math.min(curPct, 100)}%;background:${CLASS_COLORS[cls]}"></i></div>
      <input type="number" min="0" max="100" value="${tgt}" data-target="${cls}" />
      <span class="reb-action ${actionCls}">${curPct.toFixed(1)}% → ${tgt}% · ${action}</span>`;
    wrap.appendChild(row);
  }
}

document.getElementById("rebalance").addEventListener("input", (e) => {
  const cls = e.target.dataset.target;
  if (!cls) return;
  targets[cls] = Math.max(0, +e.target.value || 0);
  save();
  renderRebalance();
});

/* ============ HISTORY (snapshot del valore) ============ */
function recordSnapshot() {
  if (!holdings.length) return;
  const val = +totalValue().toFixed(2);
  const d = today();
  const last = history[history.length - 1];
  if (last && last.date === d) last.value = val;     // aggiorna l'istantanea di oggi
  else history.push({ date: d, value: val });
  if (history.length > 1825) history = history.slice(-1825); // ~5 anni
  saveHistory();
}

function renderHistoryChart() {
  const hint = document.getElementById("historyHint");
  const ctx = document.getElementById("historyChart");
  if (!ctx || !window.Chart) return;
  charts.history?.destroy();

  if (history.length < 2) {
    hint.hidden = false;
    emptyChart("historyChart");
    return;
  }
  hint.hidden = true;
  const labels = history.map((p) => p.date);
  const data = history.map((p) => p.value);
  charts.history = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Valore", data,
        borderColor: "#5b8cff", backgroundColor: "rgba(91,140,255,0.15)",
        fill: true, tension: 0.25, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => euro(c.parsed.y) } } },
      scales: {
        x: { ticks: { color: "#8b95a7", maxTicksLimit: 8 }, grid: { color: "#28303f" } },
        y: { ticks: { color: "#8b95a7", callback: (v) => `€${(v / 1000).toFixed(1)}k` }, grid: { color: "#28303f" } },
      },
    },
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("Cancellare tutto lo storico del valore?")) return;
  history = [];
  saveHistory();
  renderHistoryChart();
});

/* ============ CHART HELPERS ============ */
function drawDoughnut(id, labels, data, colors) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  charts[id]?.destroy();
  if (!data.length) { emptyChart(id); return; }
  charts[id] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: "#161c28", borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#8b95a7", padding: 14, font: { size: 12 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${euro(c.parsed)}` } },
      },
    },
  });
}

function drawBar(id, labels, data, colors) {
  const ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return;
  charts[id]?.destroy();
  if (!data.length) { emptyChart(id); return; }
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => euro(c.parsed.x) } } },
      scales: {
        x: { ticks: { color: "#8b95a7", callback: (v) => `€${v}` }, grid: { color: "#28303f" } },
        y: { ticks: { color: "#e8ecf3" }, grid: { display: false } },
      },
    },
  });
}

function emptyChart(id) {
  const c = document.getElementById(id);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#8b95a7";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Nessun dato", c.width / 2, c.height / 2);
}

/* ============ LIVE PRICES ============ */
async function refreshPrices() {
  const statusEl = document.getElementById("priceStatus");
  const cryptoIds = [...new Set(holdings.filter((h) => LIVE[h.cls]?.source === "coingecko" && h.symbol).map((h) => h.symbol))];
  const stooqSyms = [...new Set(holdings.filter((h) => LIVE[h.cls]?.source === "stooq" && h.symbol).map((h) => h.symbol))];

  if (!cryptoIds.length && !stooqSyms.length) { statusEl.textContent = "·"; statusEl.className = "status"; return; }
  statusEl.textContent = "aggiorno…"; statusEl.className = "status";

  let updated = 0, failed = 0;
  const results = await Promise.allSettled([
    cryptoIds.length ? fetchCrypto(cryptoIds) : Promise.resolve({}),
    stooqSyms.length ? fetchStooq(stooqSyms) : Promise.resolve({}),
  ]);
  const prices = {};
  for (const r of results) {
    if (r.status === "fulfilled") Object.assign(prices, r.value);
    else failed++;
  }
  for (const h of holdings) {
    if (h.symbol && prices[h.symbol] != null) { h.now = prices[h.symbol]; updated++; }
  }
  save();

  if (updated) { statusEl.textContent = `● ${updated} live`; statusEl.className = "status ok"; }
  else { statusEl.textContent = "● prezzi offline"; statusEl.className = "status err"; }

  renderHoldings();
  recordSnapshot();
  if (document.getElementById("view-dashboard").classList.contains("active")) renderDashboard();
}

async function fetchCrypto(ids) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("coingecko " + res.status);
  const data = await res.json();
  const out = {};
  for (const id of ids) if (data[id]?.eur != null) out[id] = data[id].eur;
  return out;
}

// Stooq: CSV per simbolo. Es. https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv
async function fetchStooq(syms) {
  const out = {};
  await Promise.all(syms.map(async (s) => {
    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
      const res = await fetch(url);
      if (!res.ok) return;
      const text = (await res.text()).trim();
      const lines = text.split("\n");
      if (lines.length < 2) return;
      const cols = lines[1].split(",");
      const close = parseFloat(cols[6]); // Symbol,Date,Time,Open,High,Low,Close,Volume
      if (!isNaN(close) && close > 0) out[s] = close;
    } catch { /* skip simbolo */ }
  }));
  if (!Object.keys(out).length) throw new Error("stooq: nessun prezzo (possibile blocco CORS)");
  return out;
}

document.getElementById("refreshBtn").addEventListener("click", refreshPrices);

/* ============ IMPORT / EXPORT / SEED ============ */
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ holdings, targets, history }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `portafoglio-${today()}.json`;
  a.click();
});
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (Array.isArray(obj.holdings)) holdings = obj.holdings.map(migrate);
      if (obj.targets) targets = obj.targets;
      if (Array.isArray(obj.history)) { history = obj.history; saveHistory(); }
      save(); renderHoldings(); refreshPrices();
    } catch { alert("File non valido."); }
  };
  reader.readAsText(file);
});

function seed() {
  holdings = [
    { id: uid(), name: "VWCE", cls: "ETF", symbol: "vwce.de", qty: 25, avg: 105, now: 118 },
    { id: uid(), name: "SWDA", cls: "ETF", symbol: "", qty: 30, avg: 80, now: 92 },
    { id: uid(), name: "Apple", cls: "Azioni", symbol: "aapl.us", qty: 8, avg: 160, now: 195 },
    { id: uid(), name: "Bitcoin", cls: "Crypto", symbol: "bitcoin", qty: 0.05, avg: 38000, now: 38000 },
    { id: uid(), name: "Ethereum", cls: "Crypto", symbol: "ethereum", qty: 0.8, avg: 2200, now: 2200 },
    { id: uid(), name: "Conto deposito", cls: "Liquidità", symbol: "", qty: 1, avg: 3000, now: 3000 },
  ];
  save(); renderHoldings(); refreshPrices();
}
document.getElementById("seedBtn").addEventListener("click", seed);
document.getElementById("seedLink").addEventListener("click", seed);

/* ============ PAC SIMULATOR ============ */
const pacInputs = ["pInit", "pMonthly", "pYears", "pRate", "pInfl"];
pacInputs.forEach((id) => document.getElementById(id).addEventListener("input", renderPac));

function renderPac() {
  const init = +document.getElementById("pInit").value || 0;
  const monthly = +document.getElementById("pMonthly").value || 0;
  const years = +document.getElementById("pYears").value || 0;
  const rate = +document.getElementById("pRate").value || 0;
  const infl = +document.getElementById("pInfl").value || 0;

  document.getElementById("pYearsLabel").textContent = years;
  document.getElementById("pRateLabel").textContent = `${rate}%`;
  document.getElementById("pInflLabel").textContent = `${infl}%`;

  const monthlyRate = rate / 100 / 12;
  const labels = [], valueSeries = [], investedSeries = [];
  let value = init, invested = init;

  for (let y = 0; y <= years; y++) {
    labels.push(`Anno ${y}`);
    valueSeries.push(Math.round(value));
    investedSeries.push(Math.round(invested));
    for (let m = 0; m < 12 && y < years; m++) {
      value = value * (1 + monthlyRate) + monthly;
      invested += monthly;
    }
  }

  const finalVal = value;
  const gain = finalVal - invested;
  const realVal = finalVal / Math.pow(1 + infl / 100, years);

  document.getElementById("pacFinal").textContent = euro(finalVal);
  document.getElementById("pacInvested").textContent = euro(invested);
  document.getElementById("pacGain").textContent = euro(gain);
  document.getElementById("pacReal").textContent = euro(realVal);

  drawPacChart(labels, valueSeries, investedSeries);
}

function drawPacChart(labels, value, invested) {
  const ctx = document.getElementById("pacChart");
  if (!ctx || !window.Chart) return;
  charts.pac?.destroy();
  charts.pac = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Valore", data: value, borderColor: "#5b8cff", backgroundColor: "rgba(91,140,255,0.15)", fill: true, tension: 0.3, pointRadius: 0 },
        { label: "Versato", data: invested, borderColor: "#8b95a7", borderDash: [6, 4], fill: false, tension: 0.3, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#8b95a7" } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${euro(c.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: "#8b95a7", maxTicksLimit: 10 }, grid: { color: "#28303f" } },
        y: { ticks: { color: "#8b95a7", callback: (v) => `€${(v / 1000).toFixed(0)}k` }, grid: { color: "#28303f" } },
      },
    },
  });
}

/* ============ PWA ============ */
let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ============ UTILS ============ */
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fmtNum(n) { return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 }).format(n); }

/* ============ INIT ============ */
function init() {
  updateSymbolField();
  renderHoldings();
  renderDashboard();
  renderPac();
  refreshPrices();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
