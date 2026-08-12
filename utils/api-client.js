/**
 * SmartSniper Pro — ApiClient + ArbitrageCalculator
 * Mock backend with Stale-While-Revalidate local cache.
 */
(function (root) {
  "use strict";

  var PLATFORM_FEE_RATE = 0.13;
  var MIN_NET_ROI = 0.25;
  var SWR_TTL_MS = 5 * 60 * 1000;
  var SWR_STALE_MS = 15 * 60 * 1000;

  var INBOUND_SHIPPING = {
    amazon: 0,
    ebay: 6.9,
    zalando: 0,
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
        qualifies: roiNet >= MIN_NET_ROI,
        minRoiRequired: MIN_NET_ROI,
        formula:
          "ROI = (FMV - 13% fees - outbound shipping - (purchase + inbound)) / (purchase + inbound)"
      };
    },

    shouldAlert: function (input) {
      return ArbitrageCalculator.calculate(input).qualifies;
    }
  };

  var MOCK_CATALOG = {
    "ss-demo-sony-wh1000": {
      productId: "ss-demo-sony-wh1000",
      title: "Sony WH-1000XM5 Noise Cancelling",
      merchant: "demo",
      url: "",
      currentPrice: 278,
      previousPrice: 379,
      fairMarketValue: 410,
      inboundShipping: 4.9,
      outboundShipping: 6.5,
      sizeClass: "small",
      currency: "EUR"
    },
    "ss-demo-airpods4": {
      productId: "ss-demo-airpods4",
      title: "Apple AirPods 4",
      merchant: "amazon",
      url: "https://www.amazon.it/dp/B0DGHWD7CT",
      currentPrice: 89.89,
      previousPrice: 149,
      fairMarketValue: 145,
      inboundShipping: 0,
      outboundShipping: 4.5,
      sizeClass: "small",
      currency: "EUR"
    },
    "ss-demo-campus00s": {
      productId: "ss-demo-campus00s",
      title: "adidas Originals Campus 00s",
      merchant: "zalando",
      url: "https://www.zalando.it/adidas-originals-campus-00s-unisex-sneakers-basse-ad115o1tp-n11.html",
      currentPrice: 65.99,
      previousPrice: 119.99,
      fairMarketValue: 110,
      inboundShipping: 0,
      outboundShipping: 4.5,
      sizeClass: "small",
      currency: "EUR"
    }
  };

  var MOCK_COUPONS = {
    amazon: [
      { code: "SAVE15AMZ", type: "percent", value: 15, label: "15% Amazon cart" },
      { code: "FREESHIP", type: "shipping", value: 0, label: "Spedizione gratis" }
    ],
    ebay: [
      { code: "EBAY10OFF", type: "percent", value: 10, label: "10% eBay" },
      { code: "EBAY5EUR", type: "fixed", value: 5, label: "5€ eBay" }
    ],
    zalando: [
      { code: "ZALANDO20", type: "percent", value: 20, label: "20% Zalando" }
    ],
    demo: [
      { code: "SNIPER25", type: "percent", value: 25, label: "25% SmartSniper demo" },
      { code: "SNIPER10", type: "percent", value: 10, label: "10% SmartSniper demo" },
      { code: "SHIPFREE", type: "shipping", value: 0, label: "Spedizione gratis demo" }
    ]
  };

  var memoryCache = Object.create(null);

  function cacheKey(method, path, body) {
    return method + "::" + path + "::" + JSON.stringify(body || null);
  }

  function readStorageCache(key) {
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve(memoryCache[key] || null);
        return;
      }
      chrome.storage.local.get(["sspro_swr_cache"], function (data) {
        var bag = data.sspro_swr_cache || {};
        resolve(bag[key] || memoryCache[key] || null);
      });
    });
  }

  function writeStorageCache(key, entry) {
    memoryCache[key] = entry;
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.get(["sspro_swr_cache"], function (data) {
        var bag = data.sspro_swr_cache || {};
        bag[key] = entry;
        chrome.storage.local.set({ sspro_swr_cache: bag }, function () {
          resolve();
        });
      });
    });
  }

  function mockLatency() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 40 + Math.floor(Math.random() * 80));
    });
  }

  function mockHandler(path, body) {
    if (path === "/v1/health") {
      return { ok: true, mode: "mock", ts: Date.now() };
    }

    if (path.indexOf("/v1/coupons") === 0) {
      var merchant = "demo";
      var q = path.split("?")[1] || "";
      q.split("&").forEach(function (pair) {
        var parts = pair.split("=");
        if (parts[0] === "merchant") merchant = decodeURIComponent(parts[1] || "demo");
      });
      return {
        merchant: merchant,
        coupons: MOCK_COUPONS[merchant] || MOCK_COUPONS.demo
      };
    }

    if (path === "/v1/price/quote") {
      var productId = (body && body.productId) || "ss-demo-sony-wh1000";
      var item = MOCK_CATALOG[productId];
      if (!item) {
        item = {
          productId: productId,
          title: (body && body.title) || "Unknown product",
          merchant: (body && body.merchant) || "unknown",
          url: (body && body.url) || "",
          currentPrice: toNum(body && body.purchasePrice, 0),
          fairMarketValue: toNum(body && body.fairMarketValue, 0),
          inboundShipping: null,
          outboundShipping: null,
          sizeClass: "default",
          currency: "EUR"
        };
      }
      if (body && body.purchasePrice != null) item.currentPrice = toNum(body.purchasePrice);
      if (body && body.fairMarketValue != null) item.fairMarketValue = toNum(body.fairMarketValue);
      if (body && body.url) item.url = body.url;

      var arb = ArbitrageCalculator.calculate({
        purchasePrice: item.currentPrice,
        fairMarketValue: item.fairMarketValue,
        merchant: item.merchant,
        inboundShipping: item.inboundShipping,
        outboundShipping: item.outboundShipping,
        sizeClass: item.sizeClass
      });

      return {
        product: item,
        arbitrage: arb,
        quotedAt: new Date().toISOString()
      };
    }

    if (path === "/v1/alerts") {
      var alerts = Object.keys(MOCK_CATALOG).map(function (id) {
        var p = MOCK_CATALOG[id];
        var a = ArbitrageCalculator.calculate({
          purchasePrice: p.currentPrice,
          fairMarketValue: p.fairMarketValue,
          merchant: p.merchant,
          inboundShipping: p.inboundShipping,
          outboundShipping: p.outboundShipping,
          sizeClass: p.sizeClass
        });
        return {
          productId: p.productId,
          title: p.title,
          merchant: p.merchant,
          url: p.url,
          purchasePrice: p.currentPrice,
          fairMarketValue: p.fairMarketValue,
          currency: p.currency,
          arbitrage: a
        };
      }).filter(function (row) {
        return row.arbitrage.qualifies;
      });
      return { alerts: alerts, generatedAt: new Date().toISOString() };
    }

    if (path === "/v1/watch") {
      return { ok: true, watched: body || {}, savedAt: new Date().toISOString() };
    }

    return { ok: false, error: "unknown_endpoint", path: path };
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var key = cacheKey(method, path, body);
    var force = !!opts.force;

    return readStorageCache(key).then(function (cached) {
      var now = Date.now();
      var fresh = cached && now - cached.storedAt < SWR_TTL_MS;
      var usable = cached && now - cached.storedAt < SWR_STALE_MS;

      if (!force && fresh) {
        return Promise.resolve({
          data: cached.data,
          cache: "fresh",
          storedAt: cached.storedAt
        });
      }

      var network = mockLatency().then(function () {
        var data = mockHandler(path, body);
        var entry = { data: data, storedAt: Date.now() };
        return writeStorageCache(key, entry).then(function () {
          return { data: data, cache: "network", storedAt: entry.storedAt };
        });
      });

      if (!force && usable) {
        network.catch(function () {});
        return Promise.resolve({
          data: cached.data,
          cache: "stale",
          storedAt: cached.storedAt
        });
      }

      return network;
    });
  }

  var ApiClient = {
    getHealth: function () {
      return request("GET", "/v1/health");
    },
    getCoupons: function (merchant, opts) {
      return request("GET", "/v1/coupons?merchant=" + encodeURIComponent(merchant || "demo"), null, opts);
    },
    quotePrice: function (payload, opts) {
      return request("POST", "/v1/price/quote", payload || {}, opts);
    },
    getAlerts: function (opts) {
      return request("GET", "/v1/alerts", null, opts);
    },
    watch: function (payload, opts) {
      return request("POST", "/v1/watch", payload || {}, opts);
    },
    clearCache: function () {
      memoryCache = Object.create(null);
      return new Promise(function (resolve) {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
          resolve();
          return;
        }
        chrome.storage.local.remove(["sspro_swr_cache"], function () {
          resolve();
        });
      });
    }
  };

  root.ArbitrageCalculator = ArbitrageCalculator;
  root.ApiClient = ApiClient;
})(typeof globalThis !== "undefined" ? globalThis : self);
