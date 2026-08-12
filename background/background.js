/**
 * SmartSniper Pro — Service Worker (Manifest V3)
 * chrome.alarms polls ONLY our backend for pre-built alerts. No local scraping.
 */
/* global AffiliateRouter, ApiClient, ArbitrageCalculator */

importScripts(
  chrome.runtime.getURL("utils/affiliate.js"),
  chrome.runtime.getURL("utils/api-client.js")
);

var ALARM_NAME = "smartsniper-backend-sync";
var POLL_MINUTES = 15;
var NOTIFIED_KEY = "notifiedAlertIds";

var DEFAULT_SETTINGS = {
  pollMinutes: POLL_MINUTES,
  apiMode: "mock",
  apiBaseUrl: "https://api.smartsniper.pro",
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
  discordEnabled: false,
  discordWebhookUrl: "",
  affiliate: {},
  defaultSubId: "organic",
  minRoiPercent: 25
};

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function ensureDefaults() {
  var data = await getStorage([
    "watchedItems",
    "settings",
    "sessionDeals",
    "hotDeals",
    "initialized",
    NOTIFIED_KEY
  ]);
  var patch = {};

  if (!Array.isArray(data.watchedItems)) patch.watchedItems = [];
  if (!Array.isArray(data.sessionDeals)) patch.sessionDeals = [];
  if (!Array.isArray(data.hotDeals)) patch.hotDeals = [];
  if (!Array.isArray(data[NOTIFIED_KEY])) patch[NOTIFIED_KEY] = [];

  if (!data.settings || typeof data.settings !== "object") {
    patch.settings = Object.assign({}, DEFAULT_SETTINGS);
  } else {
    patch.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
  }

  if (!data.initialized) patch.initialized = true;

  if (Object.keys(patch).length) await setStorage(patch);
  return Object.assign({}, data, patch);
}

async function scheduleAlarm() {
  var state = await ensureDefaults();
  var minutes = Math.max(1, Number(state.settings.pollMinutes) || POLL_MINUTES);
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
}

function affiliateConfigFromSettings(settings) {
  return Object.assign({}, AffiliateRouter.DEFAULT_CONFIG, settings.affiliate || {}, {
    defaultSubId: settings.defaultSubId || "organic"
  });
}

function buildAffiliated(url, merchant, settings, subId) {
  return AffiliateRouter.buildAffiliateUrl(url, merchant, {
    config: affiliateConfigFromSettings(settings),
    subId: subId || settings.defaultSubId || "organic"
  });
}

async function deliverWebhooks(alert, settings) {
  var payload = {
    event: "smartsniper.alert",
    title: alert.title,
    merchant: alert.merchant,
    currentPrice: alert.currentPrice,
    previousPrice: alert.previousPrice,
    dropPercent: alert.dropPercent,
    roiNetPercent: alert.arbitrage ? alert.arbitrage.roiNetPercent : null,
    profit: alert.arbitrage ? alert.arbitrage.profit : null,
    url: alert.affiliateUrl,
    createdAt: alert.createdAt
  };

  var results = { telegram: false, discord: false, mock: null };

  if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
    try {
      var text =
        "*SmartSniper Pro*\n" +
        alert.title +
        "\n€" +
        alert.currentPrice +
        " (was €" +
        alert.previousPrice +
        ")\nROI netto: " +
        (alert.arbitrage ? alert.arbitrage.roiNetPercent : "?") +
        "%\n" +
        alert.affiliateUrl;
      var tgUrl =
        "https://api.telegram.org/bot" +
        settings.telegramBotToken +
        "/sendMessage";
      var tgRes = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: text,
          parse_mode: "Markdown",
          disable_web_page_preview: false
        })
      });
      results.telegram = tgRes.ok;
    } catch (e) {
      results.telegram = false;
    }
  }

  if (settings.discordEnabled && settings.discordWebhookUrl) {
    try {
      var discRes = await fetch(settings.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: null,
          embeds: [
            {
              title: "SmartSniper Pro — Deal",
              description: alert.title,
              url: alert.affiliateUrl,
              color: 0x00d4aa,
              fields: [
                { name: "Prezzo", value: "€" + alert.currentPrice, inline: true },
                {
                  name: "ROI netto",
                  value: (alert.arbitrage ? alert.arbitrage.roiNetPercent : 0) + "%",
                  inline: true
                },
                {
                  name: "Profitto stimato",
                  value: "€" + (alert.arbitrage ? alert.arbitrage.profit : 0),
                  inline: true
                }
              ]
            }
          ]
        })
      });
      results.discord = discRes.ok;
    } catch (e) {
      results.discord = false;
    }
  }

  results.mock = await ApiClient.dispatchWebhook(payload, settings);
  return results;
}

async function showNotification(alert) {
  var notificationId = "ss_" + String(alert.id || Date.now());
  var roi = alert.arbitrage ? alert.arbitrage.roiNetPercent : 0;
  var profit = alert.arbitrage ? alert.arbitrage.profit : 0;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "SmartSniper Pro — Deal trovato",
    message:
      alert.title +
      " · €" +
      alert.currentPrice +
      " · ROI netto " +
      roi +
      "% · profitto €" +
      profit,
    priority: 2,
    requireInteraction: true
  });
  return notificationId;
}

async function syncAlertsFromBackend(options) {
  options = options || {};
  var state = await ensureDefaults();
  var settings = state.settings;
  var response = await ApiClient.getAlerts();
  var alerts = Array.isArray(response.alerts) ? response.alerts : [];
  var notified = Array.isArray(state[NOTIFIED_KEY]) ? state[NOTIFIED_KEY].slice() : [];
  var hotDeals = [];
  var freshCount = 0;

  for (var i = 0; i < alerts.length; i++) {
    var alert = alerts[i];
    if (!alert.arbitrage || !alert.arbitrage.qualifies) {
      if (alert.arbitrage) {
        continue;
      }
      var recalc = ArbitrageCalculator.calculate({
        purchasePrice: alert.currentPrice,
        fairMarketValue: alert.fairMarketValue || (alert.arbitrage && alert.arbitrage.fairMarketValue),
        merchant: alert.merchant
      });
      if (!recalc.qualifies) continue;
      alert.arbitrage = recalc;
    }

    alert.affiliateUrl = buildAffiliated(
      alert.url,
      alert.merchant,
      settings,
      "notify_" + (alert.productId || i)
    );

    hotDeals.push(alert);

    var dedupeKey = String(alert.productId || alert.id) + "_" + String(alert.currentPrice);
    var already = notified.indexOf(dedupeKey) !== -1;
    if (!already || options.forceNotify) {
      await showNotification(alert);
      await deliverWebhooks(alert, settings);
      if (!already) notified.push(dedupeKey);
      freshCount += 1;
    }
  }

  if (notified.length > 200) notified = notified.slice(notified.length - 200);

  await setStorage({
    hotDeals: hotDeals,
    lastSyncAt: new Date().toISOString(),
    lastSyncMeta: {
      source: response._cache || response.source || "unknown",
      count: hotDeals.length,
      fresh: freshCount
    },
    notifiedAlertIds: notified
  });

  return {
    ok: true,
    alerts: hotDeals,
    fresh: freshCount,
    cache: response._cache || null
  };
}

chrome.runtime.onInstalled.addListener(function () {
  ensureDefaults().then(scheduleAlarm);
});

chrome.runtime.onStartup.addListener(function () {
  ensureDefaults().then(scheduleAlarm);
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_NAME) {
    syncAlertsFromBackend({ forceNotify: false }).catch(function (err) {
      console.error("[SmartSniper Pro] backend sync failed", err);
    });
  }
});

chrome.notifications.onClicked.addListener(async function (notificationId) {
  var state = await getStorage(["hotDeals", "settings"]);
  var deals = Array.isArray(state.hotDeals) ? state.hotDeals : [];
  var settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
  var match = null;
  for (var i = 0; i < deals.length; i++) {
    if (("ss_" + String(deals[i].id)).indexOf(notificationId) === 0 || notificationId.indexOf(String(deals[i].productId)) !== -1) {
      match = deals[i];
      break;
    }
  }
  if (!match && deals.length) match = deals[0];
  if (match) {
    var url = match.affiliateUrl || buildAffiliated(match.url, match.merchant, settings, "notif_click");
    await chrome.tabs.create({ url: url });
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  (async function () {
    await ensureDefaults();

    if (message && message.type === "SYNC_NOW") {
      ApiClient.clearCache();
      var result = await syncAlertsFromBackend({ forceNotify: !!message.forceNotify });
      sendResponse(result);
      return;
    }

    if (message && message.type === "WATCH_URL") {
      var quoted = await ApiClient.watchProduct(message.url, message.title);
      var state = await getStorage(["watchedItems", "settings"]);
      var items = Array.isArray(state.watchedItems) ? state.watchedItems.slice() : [];
      var watched = quoted.watched;
      var exists = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].url === watched.url || items[i].id === watched.id) {
          items[i] = Object.assign({}, items[i], watched);
          exists = true;
          break;
        }
      }
      if (!exists) items.push(watched);
      await setStorage({ watchedItems: items });
      sendResponse({ ok: true, watched: watched, items: items });
      return;
    }

    if (message && message.type === "GET_STATE") {
      var all = await getStorage([
        "watchedItems",
        "settings",
        "sessionDeals",
        "hotDeals",
        "lastSyncAt",
        "lastSyncMeta"
      ]);
      sendResponse({ ok: true, state: all });
      return;
    }

    if (message && message.type === "SAVE_SETTINGS") {
      var cur = await getStorage(["settings"]);
      var next = Object.assign({}, DEFAULT_SETTINGS, cur.settings || {}, message.settings || {});
      await setStorage({ settings: next });
      await scheduleAlarm();
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message && message.type === "RECORD_DEAL") {
      var dealsState = await getStorage(["sessionDeals"]);
      var sessionDeals = Array.isArray(dealsState.sessionDeals) ? dealsState.sessionDeals.slice() : [];
      var deal = Object.assign({}, message.deal || {}, {
        id: "deal_" + Date.now(),
        recordedAt: new Date().toISOString()
      });
      if (deal.url) {
        var st = await getStorage(["settings"]);
        var settings = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
        deal.affiliateUrl = buildAffiliated(
          deal.url,
          deal.merchant,
          settings,
          "coupon_" + (deal.code || "x")
        );
      }
      sessionDeals.unshift(deal);
      if (sessionDeals.length > 50) sessionDeals = sessionDeals.slice(0, 50);
      await setStorage({ sessionDeals: sessionDeals });
      sendResponse({ ok: true, deal: deal, sessionDeals: sessionDeals });
      return;
    }

    if (message && message.type === "BUILD_AFFILIATE_URL") {
      var st2 = await getStorage(["settings"]);
      var settings2 = Object.assign({}, DEFAULT_SETTINGS, st2.settings || {});
      var affiliated = buildAffiliated(message.url, message.merchant, settings2, message.subId);
      sendResponse({ ok: true, url: affiliated });
      return;
    }

    if (message && message.type === "TEST_WEBHOOK") {
      var st3 = await getStorage(["settings"]);
      var settings3 = Object.assign({}, DEFAULT_SETTINGS, st3.settings || {});
      var sample = {
        id: "test_" + Date.now(),
        title: "Test webhook SmartSniper Pro",
        merchant: "demo",
        url: "http://127.0.0.1:8765/demo/product-demo.html",
        currentPrice: 278,
        previousPrice: 379,
        dropPercent: 26.6,
        arbitrage: ArbitrageCalculator.calculate({
          purchasePrice: 278,
          fairMarketValue: 410,
          merchant: "demo",
          inboundShipping: 4.9,
          outboundShipping: 6.5,
          sizeClass: "small"
        }),
        createdAt: new Date().toISOString()
      };
      sample.affiliateUrl = buildAffiliated(sample.url, "demo", settings3, "webhook_test");
      var delivered = await deliverWebhooks(sample, settings3);
      sendResponse({ ok: true, delivered: delivered, sample: sample });
      return;
    }

    sendResponse({ ok: false, error: "unknown_message" });
  })().catch(function (err) {
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  });

  return true;
});
