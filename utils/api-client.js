(function (root) {
  "use strict";

  var PLATFORM_FEE_RATE = 0.13;
  var MIN_NET_ROI = 0.3;
  var SWR_TTL_MS = 5 * 60 * 1000;
  var SWR_STALE_MS = 30 * 60 * 1000;
  var CACHE_STORAGE_KEY = "sspro_swr_cache";

  var INBOUND_SHIPPING = {
    amazon: 0,
    ebay: 6.9,
    zalando: 0,
    mediaworld: 5.99,
    unieuro: 5.99,
    demo: 4.9,
    unknown: 7.5
  };

  var OUTBOUND_SHIPPING = {
    default: 6.5,
    bulky: 14.9,
    small: 4.5
  };

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback || 0;
  }

  var ArbitrageCalculator = {
    PLATFORM_FEE_RATE: PLATFORM_FEE_RATE,
    MIN_NET_ROI: MIN_NET_ROI,
    calculate: function (input) {
      input = input || {};
      var purchasePrice = toNum(input.purchasePrice);
      var fairMarketValue = toNum(input.fairMarketValue);
      var merchant = String(input.merchant || "unknown").toLowerCase();
      var feeRate = toNum(input.platformFeeRate, PLATFORM_FEE_RATE);
      var inbound =
        input.inboundShipping != null
          ? toNum(input.inboundShipping)
          : INBOUND_SHIPPING[merchant] != null
            ? INBOUND_SHIPPING[merchant]
            : INBOUND_SHIPPING.unknown;
      var sizeClass = input.sizeClass || "default";
      var outbound =
        input.outboundShipping != null
          ? toNum(input.outboundShipping)
          : OUTBOUND_SHIPPING[sizeClass] != null
            ? OUTBOUND_SHIPPING[sizeClass]
            : OUTBOUND_SHIPPING.default;
      var buyCost = purchasePrice + inbound;
      var platformFees = fairMarketValue * feeRate;
      var sellNet = fairMarketValue - platformFees - outbound;
      var profit = sellNet - buyCost;
      var roiNet = buyCost > 0 ? profit / buyCost : 0;
      return {
        purchasePrice: purchasePrice,
        inboundShipping: inbound,
        buyCost: round2(buyCost),
        fairMarketValue: fairMarketValue,
        platformFeeRate: feeRate,
        platformFees: round2(platformFees),
        outboundShipping: outbound,
        sellNet: round2(sellNet),
        profit: round2(profit),
        roiNet: roiNet,
        roiNetPercent: round2(roiNet * 100),
        qualifies: roiNet > MIN_NET_ROI,
        minRoiRequired: MIN_NET_ROI,
        minRoiPercent: MIN_NET_ROI * 100
      };
    },
    shouldAlert: function (input) {
      return ArbitrageCalculator.calculate(input).qualifies;
    }
  };

  var MOCK_COUPONS = {
    amazon: [
      { code: "SAVE15AMZ", type: "percent", value: 15, cashbackPercent: 2, label: "15% Amazon" },
      { code: "FREESHIP", type: "shipping", value: 0, cashbackPercent: 1, label: "Spedizione gratis" }
    ],
    ebay: [
      { code: "EBAY10OFF", type: "percent", value: 10, cashbackPercent: 1.5, label: "10% eBay" },
      { code: "EBAY5EUR", type: "fixed", value: 5, cashbackPercent: 1, label: "5€ eBay" }
    ],
    zalando: [
      { code: "ZALANDO20", type: "percent", value: 20, cashbackPercent: 3, label: "20% Zalando" },
      { code: "STYLE5", type: "fixed", value: 5, cashbackPercent: 2, label: "5€ Zalando" }
    ],
    mediaworld: [
      { code: "MW15TECH", type: "percent", value: 15, cashbackPercent: 2, label: "15% MediaWorld" },
      { code: "MW10EUR", type: "fixed", value: 10, cashbackPercent: 1, label: "10€ MediaWorld" }
    ],
    unieuro: [
      { code: "UNI12", type: "percent", value: 12, cashbackPercent: 2, label: "12% Unieuro" },
      { code: "UNI8EUR", type: "fixed", value: 8, cashbackPercent: 1, label: "8€ Unieuro" }
    ],
    demo: [
      { code: "SNIPER25", type: "percent", value: 25, cashbackPercent: 4, label: "25% Demo" },
      { code: "SNIPER10", type: "percent", value: 10, cashbackPercent: 2, label: "10% Demo" },
      { code: "FLAT15", type: "fixed", value: 15, cashbackPercent: 3, label: "15€ Demo" },
      { code: "DEADCODE", type: "percent", value: 0, cashbackPercent: 0, label: "Invalido" }
    ]
  };

  async function readCacheStore() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return {};
    }
    var data = await chrome.storage.local.get([CACHE_STORAGE_KEY]);
    return data[CACHE_STORAGE_KEY] && typeof data[CACHE_STORAGE_KEY] === "object"
      ? data[CACHE_STORAGE_KEY]
      : {};
  }

  async function writeCacheStore(store) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }
    var payload = {};
    payload[CACHE_STORAGE_KEY] = store;
    await chrome.storage.local.set(payload);
  }

  async function cacheGet(key) {
    var store = await readCacheStore();
    return store[key] || null;
  }

  async function cacheSet(key, data) {
    var store = await readCacheStore();
    store[key] = { data: data, storedAt: Date.now() };
    var keys = Object.keys(store);
    if (keys.length > 80) {
      keys.sort(function (a, b) {
        return (store[a].storedAt || 0) - (store[b].storedAt || 0);
      });
      for (var i = 0; i < keys.length - 60; i++) {
        delete store[keys[i]];
      }
    }
    await writeCacheStore(store);
    return store[key];
  }

  function isFresh(entry) {
    return entry && Date.now() - entry.storedAt < SWR_TTL_MS;
  }

  function isUsableStale(entry) {
    return entry && Date.now() - entry.storedAt < SWR_STALE_MS;
  }

  function enrichDeal(deal) {
    var arb = ArbitrageCalculator.calculate({
      purchasePrice: deal.purchasePrice,
      fairMarketValue: deal.fairMarketValue,
      merchant: deal.merchant,
      inboundShipping: deal.inboundShipping,
      outboundShipping: deal.outboundShipping,
      sizeClass: deal.sizeClass
    });
    var affiliateUrl =
      root.AffiliateRouter && root.AffiliateRouter.buildUrl
        ? root.AffiliateRouter.buildUrl(deal.url, deal.merchant, {
            subId: "feed_" + String(deal.id || "x")
          })
        : deal.url;
    return Object.assign({}, deal, {
      arbitrage: arb,
      alertEligible: arb.qualifies,
      affiliateUrl: affiliateUrl
    });
  }

  async function loadDealsFeedFromExtension() {
    var url =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("demo/deals-feed.json")
        : "demo/deals-feed.json";
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("deals-feed HTTP " + res.status);
    }
    return res.json();
  }

  async function mockBackend(method, path) {
    var route = String(path || "").split("?")[0];
    var query = new URLSearchParams(String(path).split("?")[1] || "");

    if (method === "GET" && route === "/v1/health") {
      return { ok: true, mode: "mock", ts: Date.now() };
    }

    if (method === "GET" && route === "/v1/coupons") {
      var merchant = (query.get("merchant") || "demo").toLowerCase();
      return {
        merchant: merchant,
        coupons: MOCK_COUPONS[merchant] || MOCK_COUPONS.demo
      };
    }

    if (method === "GET" && (route === "/v1/alerts" || route === "/v1/deals-feed")) {
      var feed = await loadDealsFeedFromExtension();
      var deals = Array.isArray(feed.deals) ? feed.deals : [];
      var alerts = [];
      for (var i = 0; i < deals.length; i++) {
        var enriched = enrichDeal(deals[i]);
        if (enriched.alertEligible) {
          alerts.push({
            id: enriched.id,
            productId: enriched.id,
            title: enriched.name,
            name: enriched.name,
            category: enriched.category,
            merchant: enriched.merchant,
            url: enriched.url,
            affiliateUrl: enriched.affiliateUrl,
            currentPrice: enriched.purchasePrice,
            purchasePrice: enriched.purchasePrice,
            fairMarketValue: enriched.fairMarketValue,
            history: enriched.history || [],
            arbitrage: enriched.arbitrage,
            createdAt: feed.generatedAt || new Date().toISOString()
          });
        }
      }
      return {
        alerts: alerts,
        deals: alerts,
        generatedAt: feed.generatedAt || null,
        source: feed.source || "deals-feed",
        polledAt: new Date().toISOString()
      };
    }

    return { error: "not_found", path: route, status: 404 };
  }

  var ApiClient = {
    DEFAULT_BASE: "https://api.smartsniper.pro",
    getSettings: async function () {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        var data = await chrome.storage.local.get(["settings"]);
        return data.settings || {};
      }
      return {};
    },
    resolveBaseUrl: async function () {
      var settings = await ApiClient.getSettings();
      if (settings.apiBaseUrl) return String(settings.apiBaseUrl).replace(/\/$/, "");
      return ApiClient.DEFAULT_BASE;
    },
    isMockForced: async function () {
      var settings = await ApiClient.getSettings();
      if (settings.apiMode === "live") return false;
      return true;
    },
    request: async function (method, path, body) {
      var cacheKey = method + ":" + path + ":" + JSON.stringify(body || {});
      var cached = await cacheGet(cacheKey);
      if (isFresh(cached)) {
        return Object.assign({}, cached.data, { _cache: "fresh" });
      }

      var useMock = await ApiClient.isMockForced();
      var base = await ApiClient.resolveBaseUrl();

      if (!useMock) {
        try {
          var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          var timer = null;
          if (controller) {
            timer = setTimeout(function () {
              controller.abort();
            }, 4000);
          }
          var response = await fetch(base + path, {
            method: method,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-SmartSniper-Client": "pro-extension"
            },
            body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
            signal: controller ? controller.signal : undefined
          });
          if (timer) clearTimeout(timer);
          if (response.ok) {
            var json = await response.json();
            await cacheSet(cacheKey, json);
            return Object.assign({}, json, { _cache: "network" });
          }
        } catch (networkErr) {
          if (isUsableStale(cached)) {
            return Object.assign({}, cached.data, {
              _cache: "stale-while-revalidate",
              _offline: true
            });
          }
        }
      }

      try {
        var mocked = await mockBackend(method, path, body);
        await cacheSet(cacheKey, mocked);
        return Object.assign({}, mocked, {
          _cache: useMock ? "mock" : "mock-fallback"
        });
      } catch (mockErr) {
        if (isUsableStale(cached)) {
          return Object.assign({}, cached.data, {
            _cache: "stale-offline",
            _offline: true
          });
        }
        throw mockErr;
      }
    },
    getHealth: function () {
      return ApiClient.request("GET", "/v1/health");
    },
    getCoupons: function (merchant) {
      return ApiClient.request(
        "GET",
        "/v1/coupons?merchant=" + encodeURIComponent(merchant || "demo")
      );
    },
    getAlerts: function () {
      return ApiClient.request("GET", "/v1/alerts");
    },
    getDealsFeed: function () {
      return ApiClient.request("GET", "/v1/deals-feed");
    },
    clearCache: async function () {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove([CACHE_STORAGE_KEY]);
      }
    }
  };

  root.ArbitrageCalculator = ArbitrageCalculator;
  root.ApiClient = ApiClient;
})(typeof globalThis !== "undefined" ? globalThis : self);
