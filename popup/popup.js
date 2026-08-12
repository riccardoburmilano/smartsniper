(function () {
  "use strict";

  var syncBtn = document.getElementById("btn-sync");
  var syncMeta = document.getElementById("sync-meta");
  var dealsList = document.getElementById("deals-list");
  var couponsList = document.getElementById("coupons-list");
  var couponsSummary = document.getElementById("coupons-summary");
  var settingsMsg = document.getElementById("settings-msg");

  function send(type, payload) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(Object.assign({ type: type }, payload || {}), function (resp) {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { ok: false });
      });
    });
  }

  function euro(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return "€" + v.toFixed(2);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      var active = tab.getAttribute("data-tab") === name;
      tab.classList.toggle("active", active);
    });
    document.querySelectorAll(".panel").forEach(function (panel) {
      var active = panel.id === "tab-" + name;
      panel.classList.toggle("active", active);
      if (active) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      setTab(tab.getAttribute("data-tab"));
    });
  });

  function renderDeals(state) {
    var deals = Array.isArray(state.hotDeals) ? state.hotDeals : [];
    dealsList.innerHTML = "";
    if (!deals.length) {
      dealsList.innerHTML = '<p class="empty">Nessun deal con ROI netto &gt; 30%. Premi Controlla Ora.</p>';
      return;
    }
    deals.forEach(function (deal) {
      var arb = deal.arbitrage || {};
      var card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        "<h3>" +
        escapeHtml(deal.title || deal.name || "Deal") +
        '<span class="badge">ROI ' +
        (arb.roiNetPercent != null ? arb.roiNetPercent : "?") +
        "%</span></h3>" +
        "<p>" +
        escapeHtml(deal.merchant || "") +
        " · " +
        escapeHtml(deal.category || "") +
        "</p>" +
        '<div class="metrics">' +
        '<div class="metric"><b>' + euro(deal.currentPrice || deal.purchasePrice) + "</b><span>Buy</span></div>" +
        '<div class="metric"><b>' + euro(deal.fairMarketValue) + "</b><span>FMV</span></div>" +
        '<div class="metric"><b>' + euro(arb.profit) + "</b><span>Netto</span></div>" +
        "</div>" +
        '<a href="' + escapeHtml(deal.affiliateUrl || deal.url || "#") + '" target="_blank" rel="noopener">Apri affiliato</a>';
      dealsList.appendChild(card);
    });
  }

  function renderCoupons(state) {
    var deals = Array.isArray(state.sessionDeals) ? state.sessionDeals : [];
    var saved = deals.reduce(function (acc, d) { return acc + (Number(d.discount) || 0); }, 0);
    couponsSummary.textContent = deals.length + " live · risparmio " + euro(saved);
    couponsList.innerHTML = "";
    if (!deals.length) {
      couponsList.innerHTML = '<p class="empty">Apri demo/checkout-demo.html e lancia Auto-Apply.</p>';
      return;
    }
    deals.forEach(function (deal) {
      var card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        "<h3>" + escapeHtml(deal.code || deal.type || "Coupon") + "</h3>" +
        "<p>" + escapeHtml(deal.merchant || "") + " · −" + euro(deal.discount) +
        " · cb " + (deal.cashbackPercent || 0) + "%</p>" +
        (deal.affiliateUrl
          ? '<a href="' + escapeHtml(deal.affiliateUrl) + '" target="_blank" rel="noopener">Link affiliato</a>'
          : "");
      couponsList.appendChild(card);
    });
  }

  function fillSettings(settings) {
    settings = settings || {};
    document.getElementById("apiMode").value = settings.apiMode || "mock";
    document.getElementById("pollMinutes").value = settings.pollMinutes || 15;
    document.getElementById("defaultSubId").value = settings.defaultSubId || "organic";
    document.getElementById("minRoiPercent").value = settings.minRoiPercent || 30;
    var aff = Object.assign({}, AffiliateRouter.DEFAULT_CONFIG, settings.affiliate || {});
    document.getElementById("amazonTag").value = aff.amazonTag || "smartsniper-21";
    document.getElementById("awinPublisherId").value = aff.awinPublisherId || "";
    document.getElementById("ebayCampaignId").value = aff.ebayCampaignId || "";
  }

  async function refresh() {
    var resp = await send("GET_STATE");
    if (!resp.ok) {
      syncMeta.textContent = "Errore: " + (resp.error || "unknown");
      return;
    }
    var state = resp.state || {};
    renderDeals(state);
    renderCoupons(state);
    fillSettings(state.settings || {});
    var meta = state.lastSyncMeta || {};
    syncMeta.textContent =
      "Ultimo sync: " + (state.lastSyncAt || "mai") +
      " · " + (meta.source || "—") +
      " · alert " + (meta.count != null ? meta.count : "—");
  }

  syncBtn.addEventListener("click", async function () {
    syncBtn.disabled = true;
    syncBtn.textContent = "Sync…";
    var result = await send("SYNC_NOW", { forceNotify: true });
    syncBtn.disabled = false;
    syncBtn.textContent = "Controlla Ora";
    if (!result.ok) {
      syncMeta.textContent = "Sync fallita: " + (result.error || "unknown");
      return;
    }
    await refresh();
  });

  document.getElementById("settings-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var settings = {
      apiMode: document.getElementById("apiMode").value,
      pollMinutes: Number(document.getElementById("pollMinutes").value) || 15,
      defaultSubId: document.getElementById("defaultSubId").value.trim() || "organic",
      minRoiPercent: Number(document.getElementById("minRoiPercent").value) || 30,
      affiliate: {
        amazonTag: document.getElementById("amazonTag").value.trim() || "smartsniper-21",
        awinPublisherId: document.getElementById("awinPublisherId").value.trim(),
        ebayCampaignId: document.getElementById("ebayCampaignId").value.trim()
      }
    };
    var resp = await send("SAVE_SETTINGS", { settings: settings });
    settingsMsg.textContent = resp.ok ? "Salvato." : "Errore.";
    await refresh();
  });

  refresh();
})();
