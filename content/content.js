/* global AffiliateRouter, ApiClient */
(function () {
  "use strict";

  if (window.__SSPRO_CONTENT_LOADED__) return;
  window.__SSPRO_CONTENT_LOADED__ = true;

  var HOST_ID = "smartsniper-pro-host";

  function isCheckoutContext() {
    var href = String(location.href || "").toLowerCase();
    var path = String(location.pathname || "").toLowerCase();
    if (href.indexOf("checkout-demo") !== -1) return true;
    if (path.indexOf("checkout") !== -1 || path.indexOf("cart") !== -1 || path.indexOf("basket") !== -1) {
      return true;
    }
    if (document.querySelector("#coupon-code, input[name='coupon'], input[name='promo'], [data-ss-coupon]")) {
      return true;
    }
    return false;
  }

  function detectMerchant() {
    return AffiliateRouter.detectMerchant(location.href);
  }

  function findCouponInput() {
    return (
      document.querySelector("#coupon-code") ||
      document.querySelector("[data-ss-coupon]") ||
      document.querySelector("input[name='coupon']") ||
      document.querySelector("input[name='promo']") ||
      document.querySelector("input[id*='coupon' i]") ||
      document.querySelector("input[placeholder*='coupon' i]") ||
      document.querySelector("input[placeholder*='promo' i]")
    );
  }

  function findApplyButton() {
    return (
      document.querySelector("#apply-coupon") ||
      document.querySelector("[data-ss-apply-coupon]") ||
      document.querySelector("button[type='submit'][name='coupon']") ||
      Array.prototype.find.call(document.querySelectorAll("button, input[type='submit']"), function (el) {
        var t = String(el.textContent || el.value || "").toLowerCase();
        return t.indexOf("apply") !== -1 || t.indexOf("applica") !== -1 || t.indexOf("coupon") !== -1;
      })
    );
  }

  function nativeSetValue(input, value) {
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clickNative(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function applyCouponCode(code) {
    var input = findCouponInput();
    if (!input) {
      return { ok: false, error: "Campo coupon non trovato" };
    }
    input.focus();
    nativeSetValue(input, code);
    var btn = findApplyButton();
    if (btn) {
      clickNative(btn);
    } else if (input.form) {
      input.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    return { ok: true, code: code };
  }

  function pickBestCoupon(coupons) {
    var list = coupons || [];
    var best = null;
    list.forEach(function (c) {
      if (!c || !c.code) return;
      if (c.type === "percent") {
        if (!best || (best.type === "percent" && c.value > best.value) || best.type !== "percent") {
          best = c;
        }
      } else if (!best) {
        best = c;
      }
    });
    return best;
  }

  function mountOverlay(coupons) {
    if (document.getElementById(HOST_ID)) return;

    var host = document.createElement("div");
    host.id = HOST_ID;
    var shadow = host.attachShadow({ mode: "open" });

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content/content.css");
    shadow.appendChild(link);

    var wrap = document.createElement("div");
    wrap.className = "sspro-root";
    wrap.innerHTML =
      '<div class="sspro-card">' +
      '<button class="sspro-close" type="button" aria-label="Chiudi">×</button>' +
      '<p class="sspro-brand">SMARTSNIPER PRO</p>' +
      '<p class="sspro-title">Checkout Auto-Apply</p>' +
      '<p class="sspro-meta">Coupon disponibili: <strong id="sspro-count">0</strong>. Applico il migliore con eventi DOM nativi.</p>' +
      '<div class="sspro-row">' +
      '<button class="sspro-btn sspro-btn-primary" id="sspro-apply" type="button">Auto-Apply</button>' +
      '<button class="sspro-btn sspro-btn-ghost" id="sspro-shop" type="button">Apri deal</button>' +
      "</div>" +
      '<p class="sspro-status" id="sspro-status"></p>' +
      "</div>";
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);

    var best = pickBestCoupon(coupons);
    shadow.getElementById("sspro-count").textContent = String((coupons || []).length);

    shadow.querySelector(".sspro-close").addEventListener("click", function () {
      host.remove();
    });

    shadow.getElementById("sspro-apply").addEventListener("click", function () {
      var status = shadow.getElementById("sspro-status");
      if (!best) {
        status.textContent = "Nessun coupon disponibile";
        status.className = "sspro-status err";
        return;
      }
      var result = applyCouponCode(best.code);
      if (result.ok) {
        status.textContent = "Applicato " + best.code + (best.label ? " · " + best.label : "");
        status.className = "sspro-status ok";
      } else {
        status.textContent = result.error || "Applicazione fallita";
        status.className = "sspro-status err";
      }
    });

    shadow.getElementById("sspro-shop").addEventListener("click", function () {
      var merchant = detectMerchant();
      var url = AffiliateRouter.buildUrl(location.href, merchant, { subId: "content_overlay" });
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function boot() {
    if (!isCheckoutContext()) return;
    var merchant = detectMerchant();
    ApiClient.getCoupons(merchant).then(function (res) {
      var coupons = (res.data && res.data.coupons) || [];
      mountOverlay(coupons);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
