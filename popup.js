/**
 * SmartSniper — Popup dashboard
 */

const $ = (sel) => document.querySelector(sel);

const els = {
  tabs: document.querySelectorAll(".tab"),
  panelSniper: $("#panel-sniper"),
  panelSavings: $("#panel-savings"),
  form: $("#add-form"),
  inputUrl: $("#input-url"),
  inputDrop: $("#input-drop"),
  inputResale: $("#input-resale"),
  watchList: $("#watch-list"),
  watchEmpty: $("#watch-empty"),
  watchCount: $("#watch-count"),
  dealsList: $("#deals-list"),
  dealsEmpty: $("#deals-empty"),
  btnCheckNow: $("#btn-check-now"),
  btnClearDeals: $("#btn-clear-deals"),
  status: $("#status"),
  pollMinutes: $("#poll-minutes"),
};

function setStatus(msg, ms = 2500) {
  els.status.textContent = msg || "";
  if (msg && ms) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => {
      if (els.status.textContent === msg) els.status.textContent = "";
    }, ms);
  }
}

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function formatEuro(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `€${Number(value).toFixed(2)}`;
}

function formatDrop(baseline, current) {
  if (baseline == null || current == null || baseline <= 0) return { text: "—", cls: "" };
  const pct = ((baseline - current) / baseline) * 100;
  const text = `${pct >= 0 ? "−" : "+"}${Math.abs(pct).toFixed(0)}%`;
  const cls = pct >= 40 ? "drop-ok" : pct >= 15 ? "drop-warn" : "";
  return { text, cls };
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 28) + (u.pathname.length > 28 ? "…" : "");
  } catch {
    return url.slice(0, 48);
  }
}

/* Tabs */
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    els.tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    const showSniper = name === "sniper";
    els.panelSniper.classList.toggle("is-active", showSniper);
    els.panelSavings.classList.toggle("is-active", !showSniper);
    els.panelSniper.hidden = !showSniper;
    els.panelSavings.hidden = showSniper;
  });
});

/* Render watched items */
function renderWatched(items = []) {
  els.watchList.innerHTML = "";
  els.watchCount.textContent = String(items.length);
  els.watchEmpty.hidden = items.length > 0;

  for (const item of items) {
    const drop = formatDrop(item.baselinePrice, item.currentPrice);
    const targetPrice =
      item.baselinePrice != null
        ? item.baselinePrice * (1 - (Number(item.targetDropPercent) || 40) / 100)
        : null;

    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title"></div>
          <div class="card-url"></div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" data-remove>Rimuovi</button>
      </div>
      <dl class="meta">
        <div>
          <dt>Attuale</dt>
          <dd>${formatEuro(item.currentPrice)}</dd>
        </div>
        <div>
          <dt>Target (−${item.targetDropPercent ?? 40}%)</dt>
          <dd>${formatEuro(targetPrice)}</dd>
        </div>
        <div>
          <dt>Drop</dt>
          <dd class="${drop.cls}">${drop.text}</dd>
        </div>
      </dl>
      <div class="card-actions">
        <span class="deal-label">Rivendita: ${formatEuro(item.resaleEstimate)}</span>
        <a class="btn btn-ghost btn-sm" href="${item.url}" target="_blank" rel="noopener">Apri</a>
      </div>
      ${item.lastError ? `<p class="error-line">${escapeHtml(item.lastError)}</p>` : ""}
    `;
    li.querySelector(".card-title").textContent = item.title || "Prodotto";
    li.querySelector(".card-url").textContent = shortUrl(item.url);
    li.querySelector("[data-remove]").addEventListener("click", async () => {
      const res = await send("REMOVE_WATCHED_ITEM", { id: item.id });
      if (res?.ok) {
        setStatus("Articolo rimosso");
        await refresh();
      } else {
        setStatus(res?.error || "Errore rimozione");
      }
    });
    els.watchList.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDeals(deals = []) {
  els.dealsList.innerHTML = "";
  els.dealsEmpty.hidden = deals.length > 0;

  for (const deal of deals) {
    const li = document.createElement("li");
    li.className = "card";
    const when = deal.savedAt ? new Date(deal.savedAt).toLocaleTimeString("it-IT") : "";
    li.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title"></div>
          <div class="deal-label"></div>
        </div>
        <span class="deal-code"></span>
      </div>
      <div class="card-actions">
        <span class="deal-label">${escapeHtml(deal.discount || "")}${
      deal.cashback ? ` · Cashback ${escapeHtml(deal.cashback)}` : ""
    }</span>
        <span class="deal-label">${when}</span>
      </div>
    `;
    li.querySelector(".card-title").textContent = deal.merchant || "Merchant";
    li.querySelector(".deal-label").textContent = deal.label || "Coupon / cashback";
    li.querySelector(".deal-code").textContent = deal.code || "—";
    els.dealsList.appendChild(li);
  }
}

async function refresh() {
  const state = await send("GET_STATE");
  if (!state?.ok) {
    setStatus(state?.error || "Impossibile leggere lo stato");
    return;
  }
  renderWatched(state.watchedItems || []);
  renderDeals(state.sessionDeals || []);
  if (state.settings?.pollMinutes) {
    els.pollMinutes.textContent = String(state.settings.pollMinutes);
  }
  if (state.settings?.defaultDropPercent && !els.inputDrop.dataset.touched) {
    els.inputDrop.value = String(state.settings.defaultDropPercent);
  }
}

els.inputDrop.addEventListener("change", () => {
  els.inputDrop.dataset.touched = "1";
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = els.inputUrl.value.trim();
  if (!url) return;

  els.form.querySelector("button[type=submit]").disabled = true;
  setStatus("Aggiunta in corso…", 0);
  try {
    const res = await send("ADD_WATCHED_ITEM", {
      url,
      targetDropPercent: Number(els.inputDrop.value) || 40,
      resaleEstimate: els.inputResale.value === "" ? null : Number(els.inputResale.value),
    });
    if (!res?.ok) throw new Error(res?.error || "Errore");
    els.inputUrl.value = "";
    els.inputResale.value = "";
    setStatus("Articolo aggiunto al monitor");
    await refresh();
  } catch (err) {
    setStatus(err.message || "Errore aggiunta");
  } finally {
    els.form.querySelector("button[type=submit]").disabled = false;
  }
});

els.btnCheckNow.addEventListener("click", async () => {
  els.btnCheckNow.disabled = true;
  setStatus("Controllo prezzi…", 0);
  try {
    const res = await send("CHECK_PRICES_NOW");
    if (!res?.ok) throw new Error(res?.error || "Errore check");
    setStatus(`Controllati ${res.checked} · alert ${res.alerts}`);
    await refresh();
  } catch (err) {
    setStatus(err.message || "Errore");
  } finally {
    els.btnCheckNow.disabled = false;
  }
});

els.btnClearDeals.addEventListener("click", async () => {
  await send("CLEAR_SESSION_DEALS");
  setStatus("Sessione svuotata");
  await refresh();
});

refresh().catch((err) => setStatus(err.message || "Errore init"));
