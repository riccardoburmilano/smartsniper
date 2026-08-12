/* global AffiliateRouter, ApiClient, ArbitrageCalculator */
"use strict";

importScripts("../utils/affiliate.js", "../utils/api-client.js");

var ALARM_NAME = "sspro-poll";
var POLL_MINUTES = 15;
var NOTIFIED_KEY = "sspro_notified_ids";

function getStorage(keys) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(keys, function (data) {
      resolve(data || {});
    });
  });
}

function setStorage(obj) {
  return new Promise(function (resolve) {
    chrome.storage.local.set(obj, function () {
      resolve();
    });
  });
}

function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, function (existing) {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
    }
  });
}

function buildDealUrl(alert) {
  var raw = alert.url || "";
  if (!raw && alert.productId === "ss-demo-sony-wh1000") {
    raw = chrome.runtime.getURL("demo/product-demo.html");
  }
  if (!raw) return "";
  try {
    return AffiliateRouter.buildUrl(raw, alert.merchant, {
      subId: "notif_" + String(alert.productId || "deal").replace(/[^a-z0-9_-]/gi, "").slice(0, 40)
    });
  } catch (e) {
    return raw;
  }
}

function showNotification(alert) {
  var arb = alert.arbitrage || {};
  var title = "SmartSniper Pro · ROI " + (arb.roiNetPercent || 0) + "%";
  var message =
    alert.title +
    "\nAcquisto €" +
    Number(alert.purchasePrice).toFixed(2) +
    " · FMV €" +
    Number(alert.fairMarketValue).toFixed(2) +
    "\nProfitto netto €" +
    Number(arb.profit || 0).toFixed(2);

  var dealUrl = buildDealUrl(alert);
  var notifId = "sspro-" + String(alert.productId || Date.now());

  return setStorage({ ["sspro_notif_url_" + notifId]: dealUrl }).then(function () {
    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: title,
      message: message,
      priority: 2
    });
  });
}

function syncAlerts(force) {
  return ApiClient.getAlerts({ force: !!force }).then(function (res) {
    var alerts = (res.data && res.data.alerts) || [];
    return getStorage([NOTIFIED_KEY, "sspro_watchlist"]).then(function (store) {
      var notified = store[NOTIFIED_KEY] || {};
      var watchlist = store.sspro_watchlist || [];
      var qualified = [];

      alerts.forEach(function (alert) {
        var arb =
          alert.arbitrage ||
          ArbitrageCalculator.calculate({
            purchasePrice: alert.purchasePrice,
            fairMarketValue: alert.fairMarketValue,
            merchant: alert.merchant
          });
        alert.arbitrage = arb;
        if (!arb.qualifies) return;

        qualified.push(alert);
        if (!notified[alert.productId]) {
          notified[alert.productId] = Date.now();
          showNotification(alert);
        }
      });

      watchlist.forEach(function (item) {
        if (!item || !item.url) return;
        ApiClient.quotePrice(
          {
            productId: item.productId || item.url,
            title: item.title || item.url,
            merchant: item.merchant || AffiliateRouter.detectMerchant(item.url),
            url: item.url,
            purchasePrice: item.purchasePrice,
            fairMarketValue: item.fairMarketValue
          },
          { force: !!force }
        ).then(function (quoteRes) {
          var data = quoteRes.data || {};
          var arb = data.arbitrage;
          if (!arb || !arb.qualifies) return;
          var pid = (data.product && data.product.productId) || item.productId || item.url;
          if (notified[pid]) return;
          notified[pid] = Date.now();
          showNotification({
            productId: pid,
            title: (data.product && data.product.title) || item.title || "Watch deal",
            merchant: (data.product && data.product.merchant) || item.merchant,
            url: item.url,
            purchasePrice: arb.purchasePrice,
            fairMarketValue: arb.fairMarketValue,
            arbitrage: arb
          });
          setStorage({ [NOTIFIED_KEY]: notified });
        });
      });

      return setStorage({
        [NOTIFIED_KEY]: notified,
        sspro_last_sync: Date.now(),
        sspro_last_deals: qualified
      }).then(function () {
        return { ok: true, count: qualified.length, deals: qualified, cache: res.cache };
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(function () {
  ensureAlarm();
  syncAlerts(true);
});

chrome.runtime.onStartup.addListener(function () {
  ensureAlarm();
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm && alarm.name === ALARM_NAME) {
    syncAlerts(false);
  }
});

chrome.notifications.onClicked.addListener(function (notifId) {
  getStorage(["sspro_notif_url_" + notifId]).then(function (data) {
    var url = data["sspro_notif_url_" + notifId];
    if (url) chrome.tabs.create({ url: url });
  });
});

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === "SSPRO_SYNC_NOW") {
    syncAlerts(true)
      .then(function (result) {
        sendResponse(result);
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      });
    return true;
  }

  if (msg.type === "SSPRO_GET_DEALS") {
    getStorage(["sspro_last_deals", "sspro_last_sync"]).then(function (data) {
      sendResponse({
        ok: true,
        deals: data.sspro_last_deals || [],
        lastSync: data.sspro_last_sync || null
      });
    });
    return true;
  }

  if (msg.type === "SSPRO_ADD_WATCH") {
    getStorage(["sspro_watchlist"]).then(function (data) {
      var list = data.sspro_watchlist || [];
      var item = msg.payload || {};
      var exists = list.some(function (row) {
        return row.url === item.url;
      });
      if (!exists) list.push(item);
      setStorage({ sspro_watchlist: list }).then(function () {
        ApiClient.watch(item, { force: true }).then(function () {
          sendResponse({ ok: true, watchlist: list });
        });
      });
    });
    return true;
  }

  if (msg.type === "SSPRO_GET_COUPONS") {
    ApiClient.getCoupons(msg.merchant || "demo", { force: !!msg.force })
      .then(function (res) {
        sendResponse({ ok: true, coupons: (res.data && res.data.coupons) || [], cache: res.cache });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      });
    return true;
  }
});

ensureAlarm();
