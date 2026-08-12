/**
 * SmartSniper Pro — AffiliateRouter
 * Every outbound commerce URL must go through AffiliateRouter.buildUrl.
 */
(function (root) {
  "use strict";

  var DEFAULTS = {
    amazonTag: "smartsniper-21",
    ebayCampaignId: "5338771234",
    ebayCustomIdPrefix: "sspro",
    awinPublisherId: "1234567",
    awinAdvertisers: {
      zalando: "11543"
    },
    defaultSubId: "organic"
  };

  function sanitizeSubId(subId) {
    var cleaned = String(subId || DEFAULTS.defaultSubId)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 64);
    return cleaned || DEFAULTS.defaultSubId;
  }

  function detectMerchant(url) {
    try {
      var host = new URL(url).hostname.toLowerCase();
      if (host.indexOf("amazon.") !== -1) return "amazon";
      if (host.indexOf("ebay.") !== -1) return "ebay";
      if (host.indexOf("zalando.") !== -1) return "zalando";
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

  function injectAmazon(url, subId) {
    var u = new URL(url);
    u.searchParams.set("tag", DEFAULTS.amazonTag);
    u.searchParams.set("ascsubtag", subId);
    return u.toString();
  }

  function injectEbay(url, subId) {
    var u = new URL(url);
    u.searchParams.set("mkcid", "1");
    u.searchParams.set("mkrid", "710-53481-19255-0");
    u.searchParams.set("campid", DEFAULTS.ebayCampaignId);
    u.searchParams.set("customid", DEFAULTS.ebayCustomIdPrefix + "_" + subId);
    u.searchParams.set("toolid", "10001");
    u.searchParams.set("mkevt", "1");
    return u.toString();
  }

  function injectZalando(url, subId) {
    return (
      "https://www.awin1.com/cread.php?awinmid=" +
      DEFAULTS.awinAdvertisers.zalando +
      "&awinaffid=" +
      DEFAULTS.awinPublisherId +
      "&ued=" +
      encodeURIComponent(url) +
      "&clickref=" +
      encodeURIComponent(subId)
    );
  }

  function injectDemo(url, subId) {
    try {
      var u = new URL(url);
      u.searchParams.set("ss_aff", "1");
      u.searchParams.set("ss_sub", subId);
      return u.toString();
    } catch (e) {
      var join = url.indexOf("?") >= 0 ? "&" : "?";
      return url + join + "ss_aff=1&ss_sub=" + encodeURIComponent(subId);
    }
  }

  var AffiliateRouter = {
    detectMerchant: detectMerchant,

    /**
     * @param {string} url
     * @param {string} [merchant]
     * @param {{subId?: string}} [opts]
     * @returns {string}
     */
    buildUrl: function (url, merchant, opts) {
      opts = opts || {};
      if (!url || typeof url !== "string") {
        throw new Error("AffiliateRouter.buildUrl: url is required");
      }
      var subId = sanitizeSubId(opts.subId || DEFAULTS.defaultSubId);
      var merch = String(merchant || detectMerchant(url)).toLowerCase();

      if (merch === "amazon") return injectAmazon(url, subId);
      if (merch === "ebay") return injectEbay(url, subId);
      if (merch === "zalando") return injectZalando(url, subId);
      if (merch === "demo") return injectDemo(url, subId);
      return url;
    },

    /** @deprecated alias — use buildUrl */
    buildAffiliateUrl: function (url, merchant, opts) {
      return AffiliateRouter.buildUrl(url, merchant, opts);
    }
  };

  root.AffiliateRouter = AffiliateRouter;
})(typeof globalThis !== "undefined" ? globalThis : self);
