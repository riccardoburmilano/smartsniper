/**
 * SmartSniper Pro — ApiClient + ArbitrageCalculator + in-extension Mock Backend
 * Browser never scrapes merchant pages aggressively; all price intelligence is
 * requested from the backend (mocked locally with SWR cache when offline/unreachable).
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
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  /* -------------------------------------------------------------------------- */
  /* Real-world arbitrage calculator                                            */
  /* -------------------------------------------------------------------------- */

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
        minRoiPercent: MIN_NET_ROI * 100,
        formula:
          "ROI = (FMV - 13% platform fees - seller shipping - (purchase + inbound shipping)) / (purchase + inbound shipping)"
      };
    },

    shouldAlert: function (input) {
      return ArbitrageCalculator.calculate(input).qualifies;
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Mock backend dataset                                                       */
  /* -------------------------------------------------------------------------- */

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
      currency: "EUR",
      history: [
        { t: "2026-07-01", p: 379 },
        { t: "2026-07-15", p: 349 },
        { t: "2026-08-01", p: 299 },
        { t: "2026-08-10", p: 278 }
      ]
    },
    "ss-demo-dyson-v15": {
      productId: "ss-demo-dyson-v15",
      title: "Dyson V15 Detect Absolute",
      merchant: "demo",
      url: "",
      currentPrice: 549,
      previousPrice: 749,
      fairMarketValue: 620,
      inboundShipping: 0,
      outboundShipping: 14.9,
      sizeClass: "bulky",
      currency: "EUR",
      history: [
        { t: "2026-06-01", p: 749 },
        { t: "2026-07-01", p: 699 },
        { t: "2026-08-01", p: 599 },
        { t: "2026-08-11", p: 549 }
      ]
    }
  };

  var MOCK_COUPONS = {
    amazon: [
      { code: "SAVE15AMZ", type: "percent", value: 15, cashbackPercent: 2, label: "15% Amazon cart" },
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
      { code: "SNIPER25", type: "percent", value: 25, cashbackPercent: 4, label: "25% Demo max" },
      { code: "SNIPER10", type: "percent", value: 10, cashbackPercent: 2, label: "10% Demo" },
      { code: "FLAT15", type: "fixed", value: 15, cashbackPercent: 3, label: "15€ fisso Demo" },
      { code: "DEADCODE", type: "percent", value: 0, cashbackPercent: 0, label: "Codice invalido" }
    ]
  };

  function hashUrl(url) {
    var s = String(url || "");
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return "url_" + Math.abs(h);
  }

  function resolveProductFromUrl(url) {
    var lower = String(url || "").toLowerCase();
    if (lower.indexOf("product-demo") !== -1 || lower.indexOf("sony") !== -1) {
      var p = Object.assign({}, MOCK_CATALOG["ss-demo-sony-wh1000"]);
      p.url = url;
      return p;
    }
    if (lower.indexOf("dyson") !== -1) {
      var d = Object.assign({}, MOCK_CATALOG["ss-demo-dyson-v15"]);
      d.url = url;
      return d;
    }
    var synthetic = {
      productId: hashUrl(url),
      title: "Tracked product",
      merchant:
        root.AffiliateRouter && root.AffiliateRouter.detectMerchant
          ? root.AffiliateRouter.detectMerchant(url)
          : "unknown",
      url: url,
      currentPrice: 199,
      previousPrice: 249,
      fairMarketValue: 280,
      inboundShipping: null,
      outboundShipping: 6.5,
      sizeClass: "default",
      currency: "EUR",
      history: [
        { t: "2026-07-01", p: 249 },
        { t: "2026-08-01", p: 219 },
        { t: "2026-08-12", p: 199 }
      ]
    };
    return synthetic;
  }

  function enrichWithArbitrage(product) {
    var arb = ArbitrageCalculator.calculate({
      purchasePrice: product.currentPrice,
      fairMarketValue: product.fairMarketValue,
      merchant: product.merchant,
      inboundShipping: product.inboundShipping,
      outboundShipping: product.outboundShipping,
      sizeClass: product.sizeClass
    });
    var dropPercent =
      product.previousPrice > 0
        ? round2(((product.previousPrice - product.currentPrice) / product.previousPrice) * 100)
        : 0;
    return Object.assign({}, product, {
      dropPercent: dropPercent,
      arbitrage: arb,
      alertEligible: arb.qualifies
    });
  }

  /* -------------------------------------------------------------------------- */
  /* SWR cache                                                                  */
  /* -------------------------------------------------------------------------- */

  var memoryCache = {};

  function cacheGet(key) {
    return memoryCache[key] || null;
  }

  function cacheSet(key, data) {
    memoryCache[key] = { data: data, storedAt: Date.now() };
    return memoryCache[key];
  }

  function isFresh(entry) {
    return entry && Date.now() - entry.storedAt < SWR_TTL_MS;
  }

  function isUsableStale(entry) {
    return entry && Date.now() - entry.storedAt < SWR_STALE_MS;
  }

  /* -------------------------------------------------------------------------- */
  /* Mock HTTP router                                                           */
  /* -------------------------------------------------------------------------- */

  function mockDelay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms || 40);
    });
  }

  async function mockBackend(method, path, body, watchedItems) {
    await mockDelay(35);
    var parts = String(path || "").split("?")[0];

    if (method === "GET" && parts === "/v1/health") {
      return { ok: true, mode: "mock", ts: Date.now() };
    }

    if (method === "GET" && parts === "/v1/coupons") {
      var q = new URLSearchParams(String(path).split("?")[1] || "");
      var merchant = (q.get("merchant") || "demo").toLowerCase();
      return {
        merchant: merchant,
        coupons: MOCK_COUPONS[merchant] || MOCK_COUPONS.demo,
        cashbackDefaultPercent: 2
      };
    }

    if (method === "POST" && parts === "/v1/price/quote") {
      var url = body && body.url;
      var product = enrichWithArbitrage(resolveProductFromUrl(url));
      if (body && body.currentPriceHint != null) {
        product.currentPrice = toNum(body.currentPriceHint, product.currentPrice);
        product = enrichWithArbitrage(product);
      }
      return { product: product, source: "mock-proxy", cached: false };
    }

    if (method === "GET" && parts === "/v1/alerts") {
      var items = Array.isArray(watchedItems) ? watchedItems : [];
      var alerts = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var quoted = enrichWithArbitrage(
          Object.assign(resolveProductFromUrl(item.url), {
            currentPrice: item.lastPrice != null ? item.lastPrice : undefined,
            title: item.title || undefined,
            merchant: item.merchant || undefined,
            fairMarketValue: item.fairMarketValue || undefined
          })
        );
        if (item.overridePrice != null) {
          quoted.currentPrice = toNum(item.overridePrice);
          quoted = enrichWithArbitrage(quoted);
        }
        if (quoted.alertEligible) {
          var affiliateUrl =
            root.AffiliateRouter && root.AffiliateRouter.buildAffiliateUrl
              ? root.AffiliateRouter.buildAffiliateUrl(quoted.url || item.url, quoted.merchant, {
                  subId: "alert_" + quoted.productId
                })
              : quoted.url || item.url;
          alerts.push({
            id: "alert_" + quoted.productId + "_" + Date.now(),
            productId: quoted.productId,
            title: quoted.title || item.title || "Deal",
            merchant: quoted.merchant,
            url: quoted.url || item.url,
            affiliateUrl: affiliateUrl,
            currentPrice: quoted.currentPrice,
            previousPrice: quoted.previousPrice,
            dropPercent: quoted.dropPercent,
            arbitrage: quoted.arbitrage,
            createdAt: new Date().toISOString()
          });
        }
      }

      if (alerts.length === 0) {
        var demo = enrichWithArbitrage(MOCK_CATALOG["ss-demo-sony-wh1000"]);
        if (demo.alertEligible) {
          var demoUrl = "http://127.0.0.1:8765/demo/product-demo.html";
          alerts.push({
            id: "alert_demo_seed",
            productId: demo.productId,
            title: demo.title,
            merchant: "demo",
            url: demoUrl,
            affiliateUrl:
              root.AffiliateRouter && root.AffiliateRouter.buildAffiliateUrl
                ? root.AffiliateRouter.buildAffiliateUrl(demoUrl, "demo", { subId: "seed_hotdeal" })
                : demoUrl,
            currentPrice: demo.currentPrice,
            previousPrice: demo.previousPrice,
            dropPercent: demo.dropPercent,
            arbitrage: demo.arbitrage,
            createdAt: new Date().toISOString(),
            seeded: true
          });
        }
      }

      return { alerts: alerts, polledAt: new Date().toISOString(), source: "mock" };
    }

    if (method === "POST" && parts === "/v1/watch") {
      var watchProduct = enrichWithArbitrage(resolveProductFromUrl(body && body.url));
      return {
        ok: true,
        watched: {
          id: watchProduct.productId,
          url: body.url,
          title: (body && body.title) || watchProduct.title,
          merchant: watchProduct.merchant,
          lastPrice: watchProduct.currentPrice,
          fairMarketValue: watchProduct.fairMarketValue,
          addedAt: new Date().toISOString()
        }
      };
    }

    if (method === "POST" && parts === "/v1/webhooks/dispatch") {
      return {
        ok: true,
        delivered: {
          telegram: !!(body && body.telegramEnabled && body.telegramBotToken && body.telegramChatId),
          discord: !!(body && body.discordEnabled && body.discordWebhookUrl)
        },
        preview: body && body.payload ? body.payload : null
      };
    }

    return { error: "not_found", path: parts, status: 404 };
  }

  /* -------------------------------------------------------------------------- */
  /* Public ApiClient                                                           */
  /* -------------------------------------------------------------------------- */

  var ApiClient = {
    DEFAULT_BASE: "https://api.smartsniper.pro",
    MOCK_MODE_KEY: "apiMode",

    getSettings: async function () {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        var data = await chrome.storage.local.get(["settings"]);
        return data.settings || {};
      }
      return {};
    },

    getWatchedItems: async function () {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        var data = await chrome.storage.local.get(["watchedItems"]);
        return Array.isArray(data.watchedItems) ? data.watchedItems : [];
      }
      return [];
    },

    resolveBaseUrl: async function () {
      var settings = await ApiClient.getSettings();
      if (settings.apiBaseUrl) return String(settings.apiBaseUrl).replace(/\/$/, "");
      return ApiClient.DEFAULT_BASE;
    },

    isMockForced: async function () {
      var settings = await ApiClient.getSettings();
      if (settings.apiMode === "live") return false;
      if (settings.apiMode === "mock") return true;
      return true;
    },

    request: async function (method, path, body) {
      var cacheKey = method + ":" + path + ":" + JSON.stringify(body || {});
      var cached = cacheGet(cacheKey);
      if (isFresh(cached)) {
        return Object.assign({}, cached.data, { _cache: "fresh" });
      }

      var watched = await ApiClient.getWatchedItems();
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
            cacheSet(cacheKey, json);
            return Object.assign({}, json, { _cache: "network" });
          }
        } catch (networkErr) {
          if (isUsableStale(cached)) {
            return Object.assign({}, cached.data, { _cache: "stale-while-revalidate", _offline: true });
          }
        }
      }

      var mocked = await mockBackend(method, path, body, watched);
      cacheSet(cacheKey, mocked);
      if (isUsableStale(cached) && cached.data) {
        return Object.assign({}, mocked, { _cache: "revalidated" });
      }
      return Object.assign({}, mocked, { _cache: useMock ? "mock" : "mock-fallback" });
    },

    getHealth: function () {
      return ApiClient.request("GET", "/v1/health");
    },

    getCoupons: function (merchant) {
      return ApiClient.request("GET", "/v1/coupons?merchant=" + encodeURIComponent(merchant || "demo"));
    },

    quotePrice: function (url, currentPriceHint) {
      return ApiClient.request("POST", "/v1/price/quote", {
        url: url,
        currentPriceHint: currentPriceHint
      });
    },

    getAlerts: function () {
      return ApiClient.request("GET", "/v1/alerts");
    },

    watchProduct: function (url, title) {
      return ApiClient.request("POST", "/v1/watch", { url: url, title: title });
    },

    dispatchWebhook: function (payload, settings) {
      return ApiClient.request("POST", "/v1/webhooks/dispatch", {
        telegramEnabled: !!(settings && settings.telegramEnabled),
        telegramBotToken: settings && settings.telegramBotToken,
        telegramChatId: settings && settings.telegramChatId,
        discordEnabled: !!(settings && settings.discordEnabled),
        discordWebhookUrl: settings && settings.discordWebhookUrl,
        payload: payload
      });
    },

    clearCache: function () {
      memoryCache = {};
    }
  };

  root.ArbitrageCalculator = ArbitrageCalculator;
  root.ApiClient = ApiClient;
})(typeof globalThis !== "undefined" ? globalThis : self);
