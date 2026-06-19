/* Portafoglio — tracker investimenti ETF / Azioni / Crypto
 * 100% client-side. Dati in localStorage. Prezzi crypto via CoinGecko.
 * Non è consulenza finanziaria.
 */
"use strict";

const STORE_KEY = "portafoglio.holdings.v1";
const TARGET_KEY = "portafoglio.targets.v1";
const CLASSES = ["ETF", "Azioni", "Crypto", "Obbligazioni", "Liquidità"];
const CLASS_COLORS = {
  ETF: "#5b8cff", Azioni: "#7c5bff", Crypto: "#ffb15b",
  Obbligazioni: "#2ecc71", "Liquidità": "#8b95a7",
};

const euro = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);
const pct = (n) => `${n >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- State ---------- */
let holdings = load(STORE_KEY, []);
let targets = load(TARGET_KEY, { ETF: 50, Azioni: 20, Crypto: 10, Obbligazioni: 15, "Liquidità": 5 });
let charts = {};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(holdings));
  localStorage.setItem(TARGET_KEY, JSON.stringify(targets));
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
classSel.addEventListener("change", () => {
  document.querySelector(".crypto-only").hidden = classSel.value !== "Crypto";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const h = {
    id: uid(),
    name: document.getElementById("hName").value.trim(),
    cls: classSel.value,
    coinId: document.getElementById("hCoinId").value.trim().toLowerCase(),
    qty: +document.getElementById("hQty").value,
    avg: +document.getElementById("hAvg").value,
    now: document.getElementById("hNow").value === "" ? null : +document.getElementById("hNow").value,
  };
  if (!h.name || !(h.qty > 0)) return;
  holdings.push(h);
  save();
  form.reset();
  document.querySelector(".crypto-only").hidden = true;
  renderHoldings();
  if (h.coinId) refreshPrices();
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
      <td><strong>${esc(h.name)}</strong>${h.coinId ? `<br><span class="muted">${esc(h.coinId)}</span>` : ""}</td>
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
  const ctx = document.getElementById(id).getContext("2d");
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#8b95a7";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Nessun dato", ctx.canvas.width / 2, ctx.canvas.height / 2);
}

/* ============ CRYPTO PRICES (CoinGecko) ============ */
async function refreshPrices() {
  const ids = [...new Set(holdings.filter((h) => h.coinId).map((h) => h.coinId))];
  const statusEl = document.getElementById("priceStatus");
  if (!ids.length) { statusEl.textContent = "·"; statusEl.className = "status"; return; }

  statusEl.textContent = "aggiorno…"; statusEl.className = "status";
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    let updated = 0;
    for (const h of holdings) {
      if (h.coinId && data[h.coinId]?.eur != null) { h.now = data[h.coinId].eur; updated++; }
    }
    save();
    statusEl.textContent = `● ${updated} live`; statusEl.className = "status ok";
    renderHoldings();
    if (document.getElementById("view-dashboard").classList.contains("active")) renderDashboard();
  } catch (err) {
    statusEl.textContent = "● prezzi offline"; statusEl.className = "status err";
  }
}
document.getElementById("refreshBtn").addEventListener("click", refreshPrices);

/* ============ IMPORT / EXPORT / SEED ============ */
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ holdings, targets }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `portafoglio-${new Date().toISOString().slice(0, 10)}.json`;
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
      if (Array.isArray(obj.holdings)) holdings = obj.holdings;
      if (obj.targets) targets = obj.targets;
      save(); renderHoldings(); refreshPrices();
    } catch { alert("File non valido."); }
  };
  reader.readAsText(file);
});

function seed() {
  holdings = [
    { id: uid(), name: "VWCE", cls: "ETF", coinId: "", qty: 25, avg: 105, now: 118 },
    { id: uid(), name: "SWDA", cls: "ETF", coinId: "", qty: 30, avg: 80, now: 92 },
    { id: uid(), name: "Apple", cls: "Azioni", coinId: "", qty: 8, avg: 160, now: 195 },
    { id: uid(), name: "Bitcoin", cls: "Crypto", coinId: "bitcoin", qty: 0.05, avg: 38000, now: 38000 },
    { id: uid(), name: "Ethereum", cls: "Crypto", coinId: "ethereum", qty: 0.8, avg: 2200, now: 2200 },
    { id: uid(), name: "Conto deposito", cls: "Liquidità", coinId: "", qty: 1, avg: 3000, now: 3000 },
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

/* ============ UTILS ============ */
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fmtNum(n) { return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 }).format(n); }

/* ============ INIT ============ */
function init() {
  renderHoldings();
  renderDashboard();
  renderPac();
  refreshPrices();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
