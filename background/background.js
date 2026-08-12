/* global AffiliateRouter, ApiClient, ArbitrageCalculator */
importScripts(
  chrome.runtime.getURL("utils/affiliate.js"),
  chrome.runtime.getURL("utils/api-client.js")
);

var ALARM_NAME = "smartsniper-deals-feed-sync";
var POLL_MINUTES = 15;
var NOTIFIED_KEY = "notifiedAlertIds";
var MIN_ROI = 0.3;

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
  minRoiPercent: 30
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
  return AffiliateRouter.buildUrl(url, merchant, {
    config: affiliateConfigFromSettings(settings),
    subId: subId || settings.defaultSubId || "organic"
  });
}

function qualifiesRoi(arb, settings) {
  if (!arb) return false;
  var min = Number(settings && settings.minRoiPercent) / 100;
  if (!Number.isFinite(min) || min <= 0) min = MIN_ROI;
  return Number(arb.roiNet) > min;
}

async function fetchDealsFeedRaw() {
  var url = chrome.runtime.getURL("demo/deals-feed.json");
  var res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("deals-feed " + res.status);
  return res.json();
}

async function syncDealsFeed(options) {
  options = options || {};
  var state = await ensureDefaults();
  var settings = state.settings;
  var feed = await fetchDealsFeedRaw();
  var deals = Array.isArray(feed.deals) ? feed.deals : [];
  var notified = Array.isArray(state[NOTIFIED_KEY]) ? state[NOTIFIED_KEY].slice() : [];
  var hotDeals = [];
  var freshCount = 0;

  for (var i = 0; i < deals.length; i++) {
    var deal = deals[i];
    var arb = ArbitrageCalculator.calculate({
      purchasePrice: deal.purchasePrice,
      fairMarketValue: deal.fairMarketValue,
      merchant: deal.merchant,
      inboundShipping: deal.inboundShipping,
      outboundShipping: deal.outboundShipping,
      sizeClass: deal.sizeClass
    });
    if (!qualifiesRoi(arb, settings)) continue;

    var dealUrl = deal.url || deal.originalUrl || "";
    var affiliateUrl = buildAffiliated(
      dealUrl,
      deal.merchant,
      settings,
      "notify_" + String(deal.id || i)
    );
    var alert = {
      id: deal.id || "deal_" + i,
      productId: deal.id || "deal_" + i,
      title: deal.name,
      name: deal.name,
      category: deal.category || "",
      merchant: deal.merchant,
      url: dealUrl,
      affiliateUrl: affiliateUrl,
      currentPrice: deal.purchasePrice,
      purchasePrice: deal.purchasePrice,
      fairMarketValue: deal.fairMarketValue,
      history: Array.isArray(deal.history) ? deal.history : [],
      arbitrage: arb,
      createdAt: feed.generatedAt || new Date().toISOString()
    };
    hotDeals.push(alert);

    var dedupeKey = String(alert.productId) + "_" + String(alert.currentPrice);
    var already = notified.indexOf(dedupeKey) !== -1;
    if (!already || options.forceNotify) {
      await chrome.notifications.create("ss_" + String(alert.id), {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "SmartSniper Pro — Hot Deal",
        message:
          alert.title +
          " · €" +
          alert.currentPrice +
          " · ROI netto " +
          arb.roiNetPercent +
          "% · profitto €" +
          arb.profit,
        priority: 2,
        requireInteraction: true
      });
      if (!already) notified.push(dedupeKey);
      freshCount += 1;
    }
  }

  if (notified.length > 200) notified = notified.slice(notified.length - 200);

  await setStorage({
    hotDeals: hotDeals,
    lastSyncAt: new Date().toISOString(),
    lastSyncMeta: {
      source: "demo/deals-feed.json",
      count: hotDeals.length,
      fresh: freshCount,
      generatedAt: feed.generatedAt || null
    },
    notifiedAlertIds: notified
  });

  return { ok: true, alerts: hotDeals, fresh: freshCount };
}

chrome.runtime.onInstalled.addListener(function () {
  ensureDefaults().then(scheduleAlarm);
});

chrome.runtime.onStartup.addListener(function () {
  ensureDefaults().then(scheduleAlarm);
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === ALARM_NAME) {
    syncDealsFeed({ forceNotify: false }).catch(function (err) {
      console.error("[SmartSniper Pro] deals-feed sync failed", err);
    });
  }
});

chrome.notifications.onClicked.addListener(async function (notificationId) {
  var state = await getStorage(["hotDeals", "settings"]);
  var deals = Array.isArray(state.hotDeals) ? state.hotDeals : [];
  var settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
  var match = null;
  for (var i = 0; i < deals.length; i++) {
    var nid = "ss_" + String(deals[i].id);
    if (notificationId === nid || notificationId.indexOf(String(deals[i].productId)) !== -1) {
      match = deals[i];
      break;
    }
  }
  if (!match && deals.length) match = deals[0];
  if (match) {
    var url =
      match.affiliateUrl ||
      buildAffiliated(match.url, match.merchant, settings, "notif_click");
    await chrome.tabs.create({ url: url });
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  (async function () {
    await ensureDefaults();

    if (message && message.type === "SYNC_NOW") {
      await ApiClient.clearCache();
      var result = await syncDealsFeed({ forceNotify: !!message.forceNotify });
      sendResponse(result);
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
      var sessionDeals = Array.isArray(dealsState.sessionDeals)
        ? dealsState.sessionDeals.slice()
        : [];
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
      var affiliated = buildAffiliated(
        message.url,
        message.merchant,
        settings2,
        message.subId
      );
      sendResponse({ ok: true, url: affiliated });
      return;
    }

    sendResponse({ ok: false, error: "unknown_message" });
  })().catch(function (err) {
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  });
  return true;
});
