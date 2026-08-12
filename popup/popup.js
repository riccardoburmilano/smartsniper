/**
 * SmartSniper Pro — Popup dashboard
 */
(function () {
  "use strict";

  var syncBtn = document.getElementById("btn-sync");
  var syncMeta = document.getElementById("sync-meta");
  var dealsList = document.getElementById("deals-list");
  var watchedList = document.getElementById("watched-list");
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

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      var active = tab.getAttribute("data-tab") === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
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
      dealsList.innerHTML =
        '<p class="empty">Nessun hot deal con ROI netto ≥ 25%. Premi Controlla Ora o aggiungi un URL monitorato.</p>';
    } else {
      deals.forEach(function (deal) {
        var arb = deal.arbitrage || {};
        var card = document.createElement("article");
        card.className = "card";
        card.innerHTML =
          "<h3>" +
          escapeHtml(deal.title || "Deal") +
          '<span class="badge">ROI ' +
          (arb.roiNetPercent != null ? arb.roiNetPercent : "?") +
          "%</span></h3>" +
          "<p>" +
          escapeHtml(deal.merchant || "") +
          " · drop " +
          (deal.dropPercent != null ? deal.dropPercent : "?") +
          "%</p>" +
          '<div class="metrics">' +
          '<div class="metric"><b>' +
          euro(deal.currentPrice) +
          "</b><span>Acquisto</span></div>" +
          '<div class="metric"><b>' +
          euro(arb.sellNet) +
          "</b><span>Netto vendita</span></div>" +
          '<div class="metric"><b>' +
          euro(arb.profit) +
          "</b><span>Profitto</span></div>" +
          "</div>" +
          '<a href="' +
          escapeHtml(deal.affiliateUrl || deal.url || "#") +
          '" target="_blank" rel="noopener">Apri link affiliato</a>';
        dealsList.appendChild(card);
      });
    }

    var watched = Array.isArray(state.watchedItems) ? state.watchedItems : [];
    watchedList.innerHTML = "";
    if (!watched.length) {
      watchedList.innerHTML = '<p class="empty">Nessun prodotto in watchlist.</p>';
      return;
    }
    watched.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        "<h3>" +
        escapeHtml(item.title || "Watched") +
        "</h3><p>" +
        escapeHtml(item.url || "") +
        "</p><p>Last price: " +
        euro(item.lastPrice) +
        " · FMV " +
        euro(item.fairMarketValue) +
        "</p>";
      watchedList.appendChild(card);
    });
  }

  function renderCoupons(state) {
    var deals = Array.isArray(state.sessionDeals) ? state.sessionDeals : [];
    var saved = deals.reduce(function (acc, d) {
      return acc + (Number(d.discount) || 0);
    }, 0);
    var cashback = deals.reduce(function (acc, d) {
      var base = Number(d.discount) || 0;
      return acc + base * ((Number(d.cashbackPercent) || 0) / 100);
    }, 0);
    couponsSummary.textContent =
      deals.length +
      " deal sessione · risparmio coupon " +
      euro(saved) +
      " · cashback stimato " +
      euro(cashback);

    couponsList.innerHTML = "";
    if (!deals.length) {
      couponsList.innerHTML =
        '<p class="empty">Apri demo/checkout-demo.html e lancia Auto-Apply per popolare questa tab.</p>';
      return;
    }
    deals.forEach(function (deal) {
      var card = document.createElement("article");
      card.className = "card";
      var link = deal.affiliateUrl
        ? '<a href="' + escapeHtml(deal.affiliateUrl) + '" target="_blank" rel="noopener">Link affiliato</a>'
        : "";
      card.innerHTML =
        "<h3>" +
        escapeHtml(deal.code || deal.type || "Deal") +
        "</h3><p>" +
        escapeHtml(deal.merchant || "") +
        " · −" +
        euro(deal.discount) +
        " · cashback " +
        (deal.cashbackPercent || 0) +
        "%</p>" +
        link;
      couponsList.appendChild(card);
    });
  }

  function fillSettings(settings) {
    settings = settings || {};
    document.getElementById("apiMode").value = settings.apiMode || "mock";
    document.getElementById("apiBaseUrl").value = settings.apiBaseUrl || "https://api.smartsniper.pro";
    document.getElementById("pollMinutes").value = settings.pollMinutes || 15;
    document.getElementById("defaultSubId").value = settings.defaultSubId || "organic";
    var aff = Object.assign({}, AffiliateRouter.DEFAULT_CONFIG, settings.affiliate || {});
    document.getElementById("amazonTag").value = aff.amazonTag || "";
    document.getElementById("awinPublisherId").value = aff.awinPublisherId || "";
    document.getElementById("ebayCampaignId").value = aff.ebayCampaignId || "";
    document.getElementById("telegramEnabled").checked = !!settings.telegramEnabled;
    document.getElementById("telegramBotToken").value = settings.telegramBotToken || "";
    document.getElementById("telegramChatId").value = settings.telegramChatId || "";
    document.getElementById("discordEnabled").checked = !!settings.discordEnabled;
    document.getElementById("discordWebhookUrl").value = settings.discordWebhookUrl || "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    var resp = await send("GET_STATE");
    if (!resp.ok) {
      syncMeta.textContent = "Errore stato: " + (resp.error || "unknown");
      return;
    }
    var state = resp.state || {};
    renderDeals(state);
    renderCoupons(state);
    fillSettings(state.settings || {});
    var meta = state.lastSyncMeta || {};
    syncMeta.textContent =
      "Ultimo sync: " +
      (state.lastSyncAt || "mai") +
      " · source " +
      (meta.source || "—") +
      " · alert " +
      (meta.count != null ? meta.count : "—");
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
    syncMeta.textContent += " · fresh " + (result.fresh || 0);
  });

  document.getElementById("watch-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var url = document.getElementById("watch-url").value.trim();
    var title = document.getElementById("watch-title").value.trim();
    var resp = await send("WATCH_URL", { url: url, title: title });
    if (!resp.ok) {
      syncMeta.textContent = "Watch error: " + (resp.error || "unknown");
      return;
    }
    document.getElementById("watch-url").value = "";
    document.getElementById("watch-title").value = "";
    await refresh();
  });

  document.getElementById("settings-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var settings = {
      apiMode: document.getElementById("apiMode").value,
      apiBaseUrl: document.getElementById("apiBaseUrl").value.trim(),
      pollMinutes: Number(document.getElementById("pollMinutes").value) || 15,
      defaultSubId: document.getElementById("defaultSubId").value.trim() || "organic",
      affiliate: {
        amazonTag: document.getElementById("amazonTag").value.trim(),
        awinPublisherId: document.getElementById("awinPublisherId").value.trim(),
        ebayCampaignId: document.getElementById("ebayCampaignId").value.trim()
      },
      telegramEnabled: document.getElementById("telegramEnabled").checked,
      telegramBotToken: document.getElementById("telegramBotToken").value.trim(),
      telegramChatId: document.getElementById("telegramChatId").value.trim(),
      discordEnabled: document.getElementById("discordEnabled").checked,
      discordWebhookUrl: document.getElementById("discordWebhookUrl").value.trim()
    };
    var resp = await send("SAVE_SETTINGS", { settings: settings });
    settingsMsg.textContent = resp.ok ? "Settings salvate." : "Errore salvataggio.";
    await refresh();
  });

  document.getElementById("btn-test-webhook").addEventListener("click", async function () {
    settingsMsg.textContent = "Invio test…";
    var resp = await send("TEST_WEBHOOK");
    if (!resp.ok) {
      settingsMsg.textContent = "Test fallito: " + (resp.error || "unknown");
      return;
    }
    var d = resp.delivered || {};
    settingsMsg.textContent =
      "Test ok · telegram=" +
      !!(d.telegram) +
      " · discord=" +
      !!(d.discord) +
      " · mock=" +
      !!(d.mock && d.mock.ok);
  });

  refresh();
})();
