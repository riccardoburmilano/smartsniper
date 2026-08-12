(function (root) {
  "use strict";

  var NETWORK = {
    AMAZON: "amazon",
    AWIN: "awin",
    TRADEDOUBLER: "tradedoubler",
    EBAY: "ebay",
    DIRECT: "direct"
  };

  var DEFAULT_CONFIG = {
    amazonTag: "smartsniper-21",
    awinPublisherId: "1234567",
    awinAdvertisers: {
      zalando: "11543",
      mediaworld: "15049",
      unieuro: "17811"
    },
    tradeDoublerOrgId: "987654",
    tradeDoublerPrograms: {
      zalando: "285084"
    },
    ebayCampaignId: "5338771234",
    ebayCustomIdPrefix: "sspro",
    defaultSubId: "organic"
  };

  function detectMerchant(url) {
    try {
      var host = new URL(url).hostname.toLowerCase();
      if (host.indexOf("amazon.") !== -1) return "amazon";
      if (host.indexOf("ebay.") !== -1) return "ebay";
      if (host.indexOf("zalando.") !== -1) return "zalando";
      if (host.indexOf("mediaworld.") !== -1) return "mediaworld";
      if (host.indexOf("unieuro.") !== -1) return "unieuro";
      if (
        host.indexOf("127.0.0.1") !== -1 ||
        host === "localhost" ||
        String(url).indexOf("file:") === 0
      ) {
        return "demo";
      }
      return "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  function networkForMerchant(merchant) {
    switch (String(merchant || "").toLowerCase()) {
      case "amazon":
        return NETWORK.AMAZON;
      case "ebay":
        return NETWORK.EBAY;
      case "zalando":
      case "mediaworld":
      case "unieuro":
        return NETWORK.AWIN;
      case "demo":
        return NETWORK.DIRECT;
      default:
        return NETWORK.DIRECT;
    }
  }

  function sanitizeSubId(subId) {
    var cleaned = String(subId || "organic")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 64);
    return cleaned || "organic";
  }

  function injectAmazon(originalUrl, config, subId) {
    var u = new URL(originalUrl);
    u.searchParams.set("tag", config.amazonTag || "smartsniper-21");
    u.searchParams.set("ascsubtag", subId);
    return u.toString();
  }

  function injectAwin(originalUrl, merchant, config, subId) {
    var advertiserId =
      (config.awinAdvertisers && config.awinAdvertisers[merchant]) ||
      (config.awinAdvertisers && config.awinAdvertisers.zalando) ||
      "11543";
    return (
      "https://www.awin1.com/cread.php?awinmid=" +
      advertiserId +
      "&awinaffid=" +
      (config.awinPublisherId || "1234567") +
      "&ued=" +
      encodeURIComponent(originalUrl) +
      "&clickref=" +
      encodeURIComponent(subId)
    );
  }

  function injectTradeDoubler(originalUrl, merchant, config, subId) {
    var programId =
      (config.tradeDoublerPrograms && config.tradeDoublerPrograms[merchant]) ||
      "285084";
    return (
      "https://clk.tradedoubler.com/click?p=" +
      programId +
      "&a=" +
      (config.tradeDoublerOrgId || "987654") +
      "&url=" +
      encodeURIComponent(originalUrl) +
      "&epi=" +
      encodeURIComponent(subId)
    );
  }

  function injectEbay(originalUrl, config, subId) {
    var u = new URL(originalUrl);
    u.searchParams.set("mkcid", "1");
    u.searchParams.set("mkrid", "710-53481-19255-0");
    u.searchParams.set("campid", config.ebayCampaignId || "5338771234");
    u.searchParams.set(
      "customid",
      (config.ebayCustomIdPrefix || "sspro") + "_" + subId
    );
    u.searchParams.set("toolid", "10001");
    u.searchParams.set("mkevt", "1");
    return u.toString();
  }

  function injectDemo(originalUrl, subId) {
    try {
      var u = new URL(originalUrl);
      u.searchParams.set("ss_aff", "1");
      u.searchParams.set("ss_sub", subId);
      return u.toString();
    } catch (e) {
      var join = originalUrl.indexOf("?") >= 0 ? "&" : "?";
      return (
        originalUrl + join + "ss_aff=1&ss_sub=" + encodeURIComponent(subId)
      );
    }
  }

  function buildUrl(originalUrl, merchant, opts) {
    opts = opts || {};
    if (!originalUrl || typeof originalUrl !== "string") {
      throw new Error("AffiliateRouter.buildUrl: originalUrl is required");
    }
    var config = Object.assign({}, DEFAULT_CONFIG, opts.config || {});
    var subId = sanitizeSubId(opts.subId || config.defaultSubId);
    var merch = String(merchant || detectMerchant(originalUrl)).toLowerCase();
    var network = opts.network || networkForMerchant(merch);

    if (merch === "zalando" && opts.preferTradeDoubler) {
      network = NETWORK.TRADEDOUBLER;
    }

    switch (network) {
      case NETWORK.AMAZON:
        return injectAmazon(originalUrl, config, subId);
      case NETWORK.AWIN:
        return injectAwin(originalUrl, merch, config, subId);
      case NETWORK.TRADEDOUBLER:
        return injectTradeDoubler(originalUrl, merch, config, subId);
      case NETWORK.EBAY:
        return injectEbay(originalUrl, config, subId);
      case NETWORK.DIRECT:
      default:
        if (merch === "demo") return injectDemo(originalUrl, subId);
        return originalUrl;
    }
  }

  var AffiliateRouter = {
    NETWORK: NETWORK,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    detectMerchant: detectMerchant,
    networkForMerchant: networkForMerchant,
    buildUrl: buildUrl,
    buildAffiliateUrl: function (originalUrl, merchant, opts) {
      return buildUrl(originalUrl, merchant, opts);
    },
    buildBestUrl: function (originalUrl, merchant, opts) {
      return buildUrl(originalUrl, merchant, opts);
    }
  };

  root.AffiliateRouter = AffiliateRouter;
})(typeof globalThis !== "undefined" ? globalThis : self);
