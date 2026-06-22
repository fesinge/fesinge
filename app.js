/* Portafoglio — tracker investimenti ETF / Azioni / Crypto
 * 100% client-side. Dati in localStorage.
 * Prezzi: crypto via CoinGecko, azioni/ETF via Stooq.
 * Non è consulenza finanziaria.
 */
"use strict";

const STORE_KEY = "portafoglio.holdings.v1";
const TARGET_KEY = "portafoglio.targets.v1";
const HISTORY_KEY = "portafoglio.history.v1";
const FX_KEY = "portafoglio.fx.v1";
const TAX_KEY = "portafoglio.tax.v1";
const CLASSES = ["ETF", "Azioni", "Crypto", "Obbligazioni", "Liquidità"];
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY"];
const CLASS_COLORS = {
  ETF: "#5b8cff", Azioni: "#7c5bff", Crypto: "#ffb15b",
  Obbligazioni: "#2ecc71", "Liquidità": "#8b95a7",
};
// Classi che supportano prezzo live e tramite quale fonte
// Quali classi supportano il prezzo live e tramite quale fonte
const LIVE = {
  Crypto: { source: "coingecko" }, // ricerca via API CoinGecko
  ETF: { source: "stooq" },        // ricerca nel catalogo locale
  Azioni: { source: "stooq" },     // ricerca nel catalogo locale
};

// Catalogo per azioni/ETF: nome cercabile -> ticker Stooq.
// Stooq non offre una ricerca pubblica affidabile, quindi i titoli/ETF più
// comuni sono pronti qui; per gli altri c'è il campo "simbolo manuale".
const CATALOG = [
  // --- ETF (UCITS europei in EUR dove possibile) ---
  { cls: "ETF", name: "Vanguard FTSE All-World (VWCE)", symbol: "vwce.de", ccy: "EUR" },
  { cls: "ETF", name: "Vanguard S&P 500 (VUAA)", symbol: "vuaa.de", ccy: "EUR" },
  { cls: "ETF", name: "iShares Core MSCI World (EUNL / IWDA)", symbol: "eunl.de", ccy: "EUR" },
  { cls: "ETF", name: "iShares Core S&P 500 (SXR8 / CSPX)", symbol: "sxr8.de", ccy: "EUR" },
  { cls: "ETF", name: "iShares Nasdaq 100 (SXRV)", symbol: "sxrv.de", ccy: "EUR" },
  { cls: "ETF", name: "iShares Core MSCI EM IMI (EIMI)", symbol: "eimi.de", ccy: "EUR" },
  { cls: "ETF", name: "Vanguard FTSE Developed Europe (VEUR)", symbol: "veur.de", ccy: "EUR" },
  { cls: "ETF", name: "Xtrackers MSCI World (XDWD)", symbol: "xdwd.de", ccy: "EUR" },
  { cls: "ETF", name: "SPDR S&P 500 (SPY)", symbol: "spy.us", ccy: "USD" },
  { cls: "ETF", name: "Invesco QQQ — Nasdaq 100 (QQQ)", symbol: "qqq.us", ccy: "USD" },
  // --- Azioni USA ---
  { cls: "Azioni", name: "Apple (AAPL)", symbol: "aapl.us", ccy: "USD" },
  { cls: "Azioni", name: "Microsoft (MSFT)", symbol: "msft.us", ccy: "USD" },
  { cls: "Azioni", name: "Alphabet / Google (GOOGL)", symbol: "googl.us", ccy: "USD" },
  { cls: "Azioni", name: "Amazon (AMZN)", symbol: "amzn.us", ccy: "USD" },
  { cls: "Azioni", name: "Nvidia (NVDA)", symbol: "nvda.us", ccy: "USD" },
  { cls: "Azioni", name: "Meta (META)", symbol: "meta.us", ccy: "USD" },
  { cls: "Azioni", name: "Tesla (TSLA)", symbol: "tsla.us", ccy: "USD" },
  // --- Azioni Italia (Borsa Italiana) ---
  { cls: "Azioni", name: "Enel (ENEL)", symbol: "enel.it", ccy: "EUR" },
  { cls: "Azioni", name: "Eni (ENI)", symbol: "eni.it", ccy: "EUR" },
  { cls: "Azioni", name: "Intesa Sanpaolo (ISP)", symbol: "isp.it", ccy: "EUR" },
  { cls: "Azioni", name: "UniCredit (UCG)", symbol: "ucg.it", ccy: "EUR" },
  { cls: "Azioni", name: "Stellantis (STLA)", symbol: "stla.it", ccy: "EUR" },
  { cls: "Azioni", name: "Generali (G)", symbol: "g.it", ccy: "EUR" },
];

const euro = (n) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);
const money = (n, ccy) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: ccy || "EUR", maximumFractionDigits: 2 }).format(n || 0);
const pct = (n) => `${n >= 0 ? "+" : ""}${(n || 0).toFixed(2)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- State ---------- */
let holdings = load(STORE_KEY, []).map(migrate);
let targets = load(TARGET_KEY, { ETF: 50, Azioni: 20, Crypto: 10, Obbligazioni: 15, "Liquidità": 5 });
let history = load(HISTORY_KEY, []);
// Tassi: 1 unità di valuta = quanti EUR. (es. fx.USD = 0.92)
let fx = load(FX_KEY, { rates: { EUR: 1 }, ts: 0 });
let tax = load(TAX_KEY, { rate: 26, bollo: 0.2, prevLoss: 0 });
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
function saveFx() { localStorage.setItem(FX_KEY, JSON.stringify(fx)); }
function saveTax() { localStorage.setItem(TAX_KEY, JSON.stringify(tax)); }

// Migrazione: vecchio campo coinId -> symbol; valuta predefinita EUR
function migrate(h) {
  if (h.symbol == null && h.coinId != null) h.symbol = h.coinId;
  if (h.symbol == null) h.symbol = "";
  if (h.ccy == null) h.ccy = "EUR";
  return h;
}

/* ---------- Derived helpers (tutto convertito in EUR) ---------- */
// 1 unità della valuta dello strumento -> EUR
const fxToEur = (ccy) => (!ccy || ccy === "EUR" ? 1 : (fx.rates[ccy] || 1));
const priceOf = (h) => (h.now != null && h.now !== "" ? +h.now : +h.avg); // valuta nativa
const valueOf = (h) => priceOf(h) * +h.qty * fxToEur(h.ccy);              // EUR
const costOf = (h) => +h.avg * +h.qty * fxToEur(h.ccy);                   // EUR
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
  if (view === "analysis") renderAnalysis();
  if (view === "pac") renderPac();
});

/* ============ HOLDINGS FORM + RICERCA ============ */
const form = document.getElementById("holdingForm");
const classSel = document.getElementById("hClass");
const nameInput = document.getElementById("hName");
const symbolInput = document.getElementById("hSymbol");
const suggestEl = document.getElementById("suggest");
const badgeEl = document.getElementById("symbolBadge");
const manualToggle = document.getElementById("manualToggle");
const manualInput = document.getElementById("hSymbolManual");
let searchTimer = null, searchSeq = 0, activeIdx = -1, currentResults = [];

// Adatta il form alla classe scelta: la ricerca live è attiva solo per
// Crypto/ETF/Azioni; per Obbligazioni/Liquidità si inserisce solo il nome.
function updateSearchMode() {
  const live = !!LIVE[classSel.value];
  document.getElementById("nameLabel").textContent = live ? "Cerca nome" : "Nome";
  nameInput.placeholder = live
    ? (classSel.value === "Crypto" ? "es. Bitcoin, Ethereum, Solana" : "es. Apple, VWCE, Enel")
    : "es. BTP 2030, Conto deposito";
  manualToggle.hidden = !live;
  clearSelection();
  hideSuggest();
}
classSel.addEventListener("change", updateSearchMode);

function setSymbol(symbol, fromManual) {
  symbolInput.value = (symbol || "").trim().toLowerCase();
  if (symbolInput.value) {
    badgeEl.hidden = false;
    badgeEl.textContent = `✓ prezzo live: ${symbolInput.value}`;
  } else {
    badgeEl.hidden = true;
  }
  if (!fromManual) { manualInput.value = symbolInput.value; }
}
function clearSelection() {
  symbolInput.value = "";
  badgeEl.hidden = true;
}

// L'utente digita: invalida la selezione precedente e cerca (con debounce).
nameInput.addEventListener("input", () => {
  clearSelection();
  const q = nameInput.value.trim();
  clearTimeout(searchTimer);
  if (!LIVE[classSel.value] || q.length < 2) { hideSuggest(); return; }
  searchTimer = setTimeout(() => runSearch(q), 280);
});
nameInput.addEventListener("keydown", onSearchKey);
nameInput.addEventListener("blur", () => setTimeout(hideSuggest, 150));

async function runSearch(q) {
  const cls = classSel.value;
  const seq = ++searchSeq;
  let results = [];
  if (cls === "Crypto") {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      results = (data.coins || []).slice(0, 8).map((c) => ({
        name: c.name, symbol: c.id, ccy: "EUR", tag: (c.symbol || "").toUpperCase(),
      }));
    } catch { results = []; }
  } else {
    const ql = q.toLowerCase();
    results = CATALOG.filter((x) => x.cls === cls &&
      (x.name.toLowerCase().includes(ql) || x.symbol.includes(ql)))
      .slice(0, 8).map((x) => ({ name: x.name, symbol: x.symbol, ccy: x.ccy, tag: x.ccy }));
  }
  if (seq !== searchSeq) return; // risultato obsoleto
  showSuggest(results, q);
}

function showSuggest(results, q) {
  currentResults = results;
  activeIdx = -1;
  suggestEl.innerHTML = "";
  for (const r of results) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${esc(r.name)}</span><span class="sym">${esc(r.symbol)}${r.tag ? " · " + esc(r.tag) : ""}</span>`;
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(r); });
    suggestEl.appendChild(li);
  }
  // Opzione sempre presente: usa il testo digitato senza prezzo live.
  const add = document.createElement("li");
  add.className = "add";
  add.innerHTML = `<span>Usa “${esc(q)}” senza prezzo live</span><span class="sym">manuale</span>`;
  add.addEventListener("mousedown", (e) => { e.preventDefault(); pick({ name: q, symbol: "" }); });
  suggestEl.appendChild(add);
  if (!results.length) {
    const none = document.createElement("li");
    none.className = "none";
    none.textContent = "Nessun risultato — usa l'opzione qui sotto o il simbolo manuale.";
    suggestEl.insertBefore(none, add);
  }
  suggestEl.hidden = false;
}
function hideSuggest() { suggestEl.hidden = true; activeIdx = -1; }

function pick(r) {
  nameInput.value = r.name;
  setSymbol(r.symbol, false);
  if (r.ccy) document.getElementById("hCcy").value = r.ccy;
  hideSuggest();
}

function onSearchKey(e) {
  if (suggestEl.hidden) return;
  const items = suggestEl.querySelectorAll("li:not(.none)");
  if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
  else if (e.key === "Enter") {
    if (activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); items[activeIdx].dispatchEvent(new MouseEvent("mousedown")); }
    return;
  } else if (e.key === "Escape") { hideSuggest(); return; }
  else return;
  items.forEach((li, i) => li.classList.toggle("active", i === activeIdx));
}

// Simbolo manuale (per strumenti non in catalogo)
manualToggle.addEventListener("click", () => {
  manualInput.hidden = !manualInput.hidden;
  if (!manualInput.hidden) manualInput.focus();
});
manualInput.addEventListener("input", () => setSymbol(manualInput.value, true));

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const h = {
    id: uid(),
    name: nameInput.value.trim(),
    cls: classSel.value,
    symbol: symbolInput.value.trim().toLowerCase(),
    ccy: document.getElementById("hCcy").value,
    qty: +document.getElementById("hQty").value,
    avg: +document.getElementById("hAvg").value,
    now: document.getElementById("hNow").value === "" ? null : +document.getElementById("hNow").value,
  };
  if (!h.name || !(h.qty > 0)) return;
  holdings.push(h);
  save();
  form.reset();
  manualInput.hidden = true;
  updateSearchMode();
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
    const ccyTag = h.ccy && h.ccy !== "EUR" ? ` <span class="muted">${h.ccy}</span>` : "";
    tr.innerHTML = `
      <td><strong>${esc(h.name)}</strong>${h.symbol ? `<br><span class="muted">${esc(h.symbol)}</span>` : ""}</td>
      <td><span class="badge">${h.cls}</span></td>
      <td class="num">${fmtNum(h.qty)}</td>
      <td class="num">${money(h.avg, h.ccy)}${ccyTag}</td>
      <td class="num">${money(priceOf(h), h.ccy)}${ccyTag}</td>
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

/* ============ ANALISI: rendimento, fisco, consigli ============ */
function renderAnalysis() {
  renderPerformance();
  renderTax();
  renderTips();
}

// CAGR, max drawdown e volatilità dallo storico dei valori
function renderPerformance() {
  const cagrEl = document.getElementById("anCagr");
  const subEl = document.getElementById("anCagrSub");
  const ddEl = document.getElementById("anDrawdown");
  const volEl = document.getElementById("anVol");

  if (history.length < 2) {
    cagrEl.textContent = ddEl.textContent = volEl.textContent = "—";
    subEl.textContent = "serve qualche giorno di storico";
    return;
  }
  const first = history[0], last = history[history.length - 1];
  const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  const years = days / 365;
  // CAGR sul valore (approssimazione: non depura i versamenti — utile come prima stima)
  if (first.value > 0 && years >= 0.05) {
    const cagr = (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
    cagrEl.textContent = pct(cagr);
    cagrEl.className = `kpi-value ${cagr >= 0 ? "pos" : "neg"}`;
    subEl.textContent = `su ${Math.round(days)} giorni di storico`;
  } else {
    cagrEl.textContent = "—";
    subEl.textContent = "storico ancora troppo breve";
  }
  // Max drawdown
  let peak = -Infinity, maxDd = 0;
  for (const p of history) { peak = Math.max(peak, p.value); if (peak > 0) maxDd = Math.min(maxDd, (p.value - peak) / peak); }
  ddEl.textContent = pct(maxDd * 100);
  ddEl.className = "kpi-value neg";
  // Volatilità: deviazione standard dei rendimenti giornalieri
  const rets = [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1].value, b = history[i].value;
    if (a > 0) rets.push(b / a - 1);
  }
  if (rets.length) {
    const m = rets.reduce((s, r) => s + r, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((s, r) => s + (r - m) ** 2, 0) / rets.length);
    volEl.textContent = `${(sd * 100).toFixed(2)}%`;
  } else volEl.textContent = "—";
}

// Stima fiscale italiana sulle plusvalenze latenti
function renderTax() {
  tax.rate = +document.getElementById("taxRate").value || 0;
  tax.bollo = +document.getElementById("taxBollo").value || 0;
  tax.prevLoss = +document.getElementById("taxPrevLoss").value || 0;
  saveTax();

  const val = totalValue();
  // Plusvalenza latente: somma dei soli guadagni (le perdite non generano imposta)
  let gain = 0;
  for (const h of holdings) {
    const g = valueOf(h) - costOf(h);
    if (g > 0) gain += g;
  }
  const taxable = Math.max(0, gain - tax.prevLoss);
  const capGain = taxable * (tax.rate / 100);
  const bollo = val * (tax.bollo / 100);
  const out = document.getElementById("taxOut");
  out.innerHTML = `
    <div class="tax-row"><span>Plusvalenza latente</span><span class="v">${euro(gain)}</span></div>
    <div class="tax-row"><span>− minusvalenze compensate</span><span class="v">${euro(Math.min(gain, tax.prevLoss))}</span></div>
    <div class="tax-row"><span>Imponibile</span><span class="v">${euro(taxable)}</span></div>
    <div class="tax-row"><span>Imposta capital gain (${tax.rate}%)</span><span class="v">${euro(capGain)}</span></div>
    <div class="tax-row"><span>Bollo titoli annuo (${tax.bollo}%)</span><span class="v">${euro(bollo)}</span></div>
    <div class="tax-row"><span>Netto se vendessi oggi</span><span class="v">${euro(val - capGain)}</span></div>`;
}
["taxRate", "taxBollo", "taxPrevLoss"].forEach((id) =>
  document.getElementById(id).addEventListener("input", () => { renderTax(); renderTips(); }));

// Consigli contestuali in base alla composizione del portafoglio
function renderTips() {
  const wrap = document.getElementById("tips");
  const val = totalValue();
  const tips = [];
  if (!holdings.length || val <= 0) {
    wrap.innerHTML = `<div class="tip"><span class="ico">💡</span><span>Aggiungi qualche posizione per ricevere consigli su diversificazione, liquidità e ribilanciamento.</span></div>`;
    return;
  }
  const byClass = valueByClass();

  // 1. Concentrazione su singola posizione
  const top = [...holdings].sort((a, b) => valueOf(b) - valueOf(a))[0];
  const topPct = (valueOf(top) / val) * 100;
  if (topPct > 35) tips.push(["bad", "⚠️", `<strong>Concentrazione alta:</strong> “${esc(top.name)}” è il ${topPct.toFixed(0)}% del portafoglio. Un singolo titolo oltre il 35% aumenta molto il rischio specifico.`]);
  else if (topPct > 20) tips.push(["warn", "📊", `“${esc(top.name)}” pesa il ${topPct.toFixed(0)}%. Tienilo d'occhio: oltre il 20-25% su un singolo strumento la diversificazione cala.`]);

  // 2. Esposizione crypto
  const cryptoPct = ((byClass.Crypto || 0) / val) * 100;
  if (cryptoPct > 20) tips.push(["warn", "🪙", `Le crypto sono il ${cryptoPct.toFixed(0)}% del portafoglio: asset molto volatile. Molti consulenti suggeriscono di restare entro il 5-10%.`]);

  // 3. Liquidità / fondo emergenza
  const cashPct = ((byClass["Liquidità"] || 0) / val) * 100;
  if (cashPct < 5) tips.push(["warn", "🛟", `Liquidità sotto il 5%. Tieni un fondo d'emergenza (3-6 mesi di spese) <em>fuori</em> dagli investimenti per non dover vendere in perdita.`]);
  else if (cashPct > 40) tips.push(["warn", "💤", `Hai il ${cashPct.toFixed(0)}% in liquidità: molto capitale fermo che l'inflazione erode. Valuta un PAC per investirlo gradualmente.`]);

  // 4. Scostamento dai target di ribilanciamento
  let drift = 0, driftCls = "";
  for (const c of CLASSES) {
    const cur = ((byClass[c] || 0) / val) * 100;
    const d = Math.abs(cur - (targets[c] ?? 0));
    if (d > drift) { drift = d; driftCls = c; }
  }
  if (drift > 7) tips.push(["warn", "🔁", `<strong>${driftCls}</strong> si è scostato di ${drift.toFixed(0)} punti dal target. Valuta un ribilanciamento (vedi la Dashboard).`]);

  // 5. Diversificazione per numero di classi
  const nClasses = Object.values(byClass).filter((v) => v > 0).length;
  if (nClasses <= 1) tips.push(["warn", "🧩", `Sei esposta a una sola classe di attivo. Diversificare tra ETF, azioni, obbligazioni e liquidità riduce il rischio complessivo.`]);

  if (!tips.length) tips.push(["ok", "✅", `Portafoglio ben bilanciato: nessun segnale critico su concentrazione, liquidità e diversificazione. Continua così e mantieni la disciplina del PAC.`]);

  // Tip educativo fisso sui costi
  tips.push(["", "💸", `<strong>Occhio al TER:</strong> su un ETF, lo 0,3% di costo annuo in più, su 20.000 € investiti per 20 anni, può valere diverse migliaia di euro. A parità di indice, scegli il più economico.`]);

  wrap.innerHTML = tips.map(([cls, ico, txt]) =>
    `<div class="tip ${cls}"><span class="ico">${ico}</span><span>${txt}</span></div>`).join("");
}

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

/* ============ LIVE PRICES + FX ============ */
async function refreshPrices() {
  const statusEl = document.getElementById("priceStatus");
  const cryptoIds = [...new Set(holdings.filter((h) => LIVE[h.cls]?.source === "coingecko" && h.symbol).map((h) => h.symbol))];
  const stooqSyms = [...new Set(holdings.filter((h) => LIVE[h.cls]?.source === "stooq" && h.symbol).map((h) => h.symbol))];

  // Tassi di cambio: serve aggiornarli se ci sono strumenti in valuta diversa dall'EUR
  await refreshFx();

  if (!cryptoIds.length && !stooqSyms.length) {
    statusEl.textContent = "·"; statusEl.className = "status";
    renderHoldings(); recordSnapshot();
    if (document.getElementById("view-dashboard").classList.contains("active")) renderDashboard();
    return;
  }
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

// Tassi BCE via Frankfurter (gratis, senza chiave, CORS-friendly). Cache 6h.
async function refreshFx() {
  const need = [...new Set(holdings.map((h) => h.ccy).filter((c) => c && c !== "EUR"))];
  if (!need.length) return;
  const fresh = Date.now() - (fx.ts || 0) < 6 * 3600 * 1000;
  const covered = need.every((c) => fx.rates[c] != null);
  if (fresh && covered) return;
  try {
    const url = `https://api.frankfurter.app/latest?from=EUR&to=${need.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("fx " + res.status);
    const data = await res.json();
    // data.rates: EUR -> CCY. Ci serve CCY -> EUR = 1 / rate.
    for (const c of need) if (data.rates?.[c]) fx.rates[c] = 1 / data.rates[c];
    fx.ts = Date.now();
    saveFx();
  } catch { /* mantiene i tassi in cache, o 1:1 se assenti */ }
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
  const blob = new Blob([JSON.stringify({ holdings, targets, history, fx, tax }, null, 2)], { type: "application/json" });
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
      if (obj.fx) { fx = obj.fx; saveFx(); }
      if (obj.tax) { tax = obj.tax; saveTax(); syncTaxInputs(); }
      save(); renderHoldings(); refreshPrices();
    } catch { alert("File non valido."); }
  };
  reader.readAsText(file);
});

function seed() {
  holdings = [
    { id: uid(), name: "VWCE", cls: "ETF", symbol: "vwce.de", ccy: "EUR", qty: 25, avg: 105, now: 118 },
    { id: uid(), name: "SWDA", cls: "ETF", symbol: "", ccy: "EUR", qty: 30, avg: 80, now: 92 },
    { id: uid(), name: "Apple", cls: "Azioni", symbol: "aapl.us", ccy: "USD", qty: 8, avg: 160, now: 195 },
    { id: uid(), name: "Bitcoin", cls: "Crypto", symbol: "bitcoin", ccy: "EUR", qty: 0.05, avg: 38000, now: 38000 },
    { id: uid(), name: "Ethereum", cls: "Crypto", symbol: "ethereum", ccy: "EUR", qty: 0.8, avg: 2200, now: 2200 },
    { id: uid(), name: "Conto deposito", cls: "Liquidità", symbol: "", ccy: "EUR", qty: 1, avg: 3000, now: 3000 },
  ];
  save(); renderHoldings(); refreshPrices();
}
document.getElementById("seedBtn").addEventListener("click", seed);
document.getElementById("seedLink").addEventListener("click", seed);

/* ============ PAC SIMULATOR ============ */
const pacInputs = ["pInit", "pMonthly", "pYears", "pRate", "pInfl", "gTarget", "gSpend", "gSwr"];
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
  renderGoal(init, monthly, rate);
}

// Pianificatore obiettivi / FIRE
function renderGoal(init, monthly, rate) {
  const target = +document.getElementById("gTarget").value || 0;
  const spend = +document.getElementById("gSpend").value || 0;
  const swr = +document.getElementById("gSwr").value || 4;
  document.getElementById("gSwrLabel").textContent = `${swr}%`;

  // Mesi necessari a raggiungere l'obiettivo (interesse composto mensile)
  const r = rate / 100 / 12;
  let v = init, months = 0;
  const cap = 1200; // max 100 anni: evita loop infiniti se irraggiungibile
  while (v < target && months < cap) { v = v * (1 + r) + monthly; months++; }

  const reach = months >= cap
    ? `Con questi parametri l'obiettivo non è raggiungibile entro 100 anni: aumenta versamento o rendimento.`
    : `Raggiungi <strong>${euro(target)}</strong> tra <strong>${fmtDuration(months)}</strong> (a ${rate}% annuo, ${euro(monthly)}/mese).`;

  // Numero FIRE: capitale che al tasso di prelievo "sicuro" copre la spesa annua
  const fireNumber = swr > 0 ? spend / (swr / 100) : 0;
  let vf = init, mf = 0;
  while (vf < fireNumber && mf < cap) { vf = vf * (1 + r) + monthly; mf++; }
  const fireWhen = mf >= cap ? "oltre 100 anni" : fmtDuration(mf);

  const out = document.getElementById("goalOut");
  out.innerHTML = `
    <div class="tip"><span class="ico">🎯</span><span>${reach}</span></div>
    <div class="tip"><span class="ico">🔥</span><span>Il tuo <strong>numero FIRE</strong> per ${euro(spend)}/anno di spesa (prelievo ${swr}%) è <strong>${euro(fireNumber)}</strong>. Lo raggiungeresti tra <strong>${fireWhen}</strong>.</span></div>
    <div class="tip"><span class="ico">📌</span><span>Regola pratica: servono circa <strong>${(100 / swr).toFixed(0)}× le spese annue</strong> per essere finanziariamente indipendente. Più basso è il tasso di prelievo, più alto (e prudente) è il capitale richiesto.</span></div>`;
}

function fmtDuration(months) {
  const y = Math.floor(months / 12), m = months % 12;
  if (y <= 0) return `${m} mes${m === 1 ? "e" : "i"}`;
  if (m === 0) return `${y} ann${y === 1 ? "o" : "i"}`;
  return `${y} ann${y === 1 ? "o" : "i"} e ${m} mes${m === 1 ? "e" : "i"}`;
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
function syncTaxInputs() {
  document.getElementById("taxRate").value = tax.rate;
  document.getElementById("taxBollo").value = tax.bollo;
  document.getElementById("taxPrevLoss").value = tax.prevLoss;
}

/* ============ INIT ============ */
function init() {
  updateSearchMode();
  syncTaxInputs();
  renderHoldings();
  renderDashboard();
  renderPac();
  refreshPrices();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
