(function () {
  "use strict";

  if (window.__SMARTSNIPER_PRO_LOADED__) return;
  window.__SMARTSNIPER_PRO_LOADED__ = true;

  var MERCHANT_SELECTORS = {
    amazon: {
      couponInput: ["#spc-gcpromoinput", "input[name='promoCode']", "input[name='claimCode']"],
      applyButton: ["#gcApplyButtonId", "#promoCodeApply", "input.a-button-input[type='submit']"],
      total: ["#opc-order-summary .grand-total-price", "#sc-subtotal-amount-activecart .sc-price", "[data-testid='order-total']"],
      price: ["#priceblock_ourprice", "#priceblock_dealprice", ".a-price .a-offscreen"]
    },
    ebay: {
      couponInput: ["input[name='promotionCode']", "#promotionCode", "input[placeholder*='code' i]"],
      applyButton: ["button[data-test-id='APPLY_PROMO']", "button[aria-label*='Apply' i]", "button.apply-promo"],
      total: ["[data-test-id='TOTAL']", ".order-summary-total"],
      price: [".x-price-primary", "[itemprop='price']"]
    },
    zalando: {
      couponInput: ["input[name='couponCode']", "input[data-testid='coupon-input']", "input[placeholder*='codice' i]"],
      applyButton: ["button[data-testid='coupon-submit']", "button.apply-coupon"],
      total: ["[data-testid='cart-total']", "[data-id='total-price']"],
      price: ["[data-testid='price']", ".price__amount"]
    },
    mediaworld: {
      couponInput: ["input#couponCode", "input[name='coupon']", "input[placeholder*='coupon' i]"],
      applyButton: ["button#applyCoupon", "button[data-action='apply-coupon']", "button.apply-coupon"],
      total: [".order-total .value", ".grand-total"],
      price: [".price-sales", ".product-price"]
    },
    unieuro: {
      couponInput: ["input#promo-code", "input[name='promoCode']", "input[placeholder*='promozionale' i]"],
      applyButton: ["button#apply-promo", "button.apply-promo"],
      total: [".cart-total .amount", "#order-total"],
      price: [".product-price", ".price"]
    },
    demo: {
      couponInput: ["#promo-code", "input[name='promoCode']", "[data-ss-coupon-input]"],
      applyButton: ["#apply-promo", "[data-ss-coupon-apply]", "button.apply-promo"],
      total: ["#order-total", "[data-ss-order-total]", ".order-total"],
      price: ["#product-price", "[data-ss-price]", "[itemprop='price']"]
    }
  };

  function detectMerchant() {
    if (globalThis.AffiliateRouter && AffiliateRouter.detectMerchant) {
      var m = AffiliateRouter.detectMerchant(location.href);
      if (m !== "unknown") return m;
    }
    if (document.querySelector("[data-ss-checkout-demo], #promo-code")) return "demo";
    return "unknown";
  }

  function isCheckoutContext() {
    var path = (location.pathname + location.search + location.hash).toLowerCase();
    if (/checkout|cart|basket|ospc|buy|pagamento|ordine/.test(path)) return true;
    if (document.querySelector("#promo-code, [data-ss-checkout-demo], input[name='promoCode']")) return true;
    if (document.querySelector("#product-price, [data-ss-price], [itemprop='price']")) return true;
    return false;
  }

  function queryFirst(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function parseMoney(text) {
    if (text == null) return null;
    var raw = String(text)
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    var n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }

  function readTotal(selectors) {
    var el = queryFirst(selectors);
    if (!el) return null;
    var attr = el.getAttribute("content") || el.getAttribute("data-price") || el.getAttribute("data-value");
    if (attr) {
      var fromAttr = parseMoney(attr);
      if (fromAttr != null) return fromAttr;
    }
    return parseMoney(el.textContent);
  }

  function setNativeValue(input, value) {
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
  }

  function clickNative(el) {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof el.click === "function") el.click();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  async function tryCoupon(code, selectors) {
    var input = queryFirst(selectors.couponInput);
    var button = queryFirst(selectors.applyButton);
    if (!input) {
      return { code: code, ok: false, reason: "input_not_found", total: null, discount: 0 };
    }
    var baseline = readTotal(selectors.total);
    setNativeValue(input, "");
    await sleep(120);
    setNativeValue(input, code);
    await sleep(80);
    if (button) clickNative(button);
    else if (input.form) input.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await sleep(450);
    var after = readTotal(selectors.total);
    var discount = 0;
    if (baseline != null && after != null) discount = Math.max(0, round2(baseline - after));
    if (typeof window.__SS_DEMO_EVAL__ === "function") {
      var evalResult = window.__SS_DEMO_EVAL__(code);
      if (evalResult && typeof evalResult.discount === "number") {
        discount = evalResult.discount;
        after = evalResult.total;
        baseline = evalResult.baseline != null ? evalResult.baseline : baseline;
      }
    }
    return {
      code: code,
      ok: discount > 0,
      reason: discount > 0 ? "applied" : "no_effect",
      baseline: baseline,
      total: after,
      discount: discount
    };
  }

  async function runAutoApply(coupons, merchant) {
    var selectors = MERCHANT_SELECTORS[merchant] || MERCHANT_SELECTORS.demo;
    var results = [];
    for (var i = 0; i < coupons.length; i++) {
      var result = await tryCoupon(coupons[i].code, selectors);
      result.label = coupons[i].label || coupons[i].code;
      result.cashbackPercent = coupons[i].cashbackPercent || 0;
      results.push(result);
      await sleep(200);
    }
    results.sort(function (a, b) {
      return b.discount - a.discount;
    });
    return results;
  }

  function buildPriceHistorySvg(history) {
    var points = Array.isArray(history) ? history.slice() : [];
    if (!points.length) {
      points = [
        { t: "T1", p: 100 },
        { t: "T2", p: 90 },
        { t: "T3", p: 80 },
        { t: "T4", p: 70 }
      ];
    }
    var values = points.map(function (p) {
      return Number(p.p);
    }).filter(function (n) {
      return Number.isFinite(n);
    });
    if (!values.length) values = [0, 1];
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (min === max) {
      min = min - 1;
      max = max + 1;
    }
    var w = 320;
    var h = 90;
    var pad = 10;
    var coords = [];
    for (var i = 0; i < values.length; i++) {
      var x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
      var y = pad + ((max - values[i]) / (max - min)) * (h - pad * 2);
      coords.push(x.toFixed(1) + "," + y.toFixed(1));
    }
    var polyline = coords.join(" ");
    var last = coords[coords.length - 1].split(",");
    return (
      '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Storico prezzi">' +
      '<defs><linearGradient id="ssg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#00d4aa" stop-opacity="0.35"/>' +
      '<stop offset="100%" stop-color="#00d4aa" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<polyline fill="none" stroke="#00d4aa" stroke-width="2.5" points="' + polyline + '"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.5" fill="#1dffc2"/>' +
      '<text x="' + pad + '" y="' + (h - 2) + '" fill="#8b98a8" font-size="9">min €' +
      min.toFixed(0) +
      " · max €" +
      max.toFixed(0) +
      "</text>" +
      "</svg>"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectOverlay() {
    if (document.getElementById("smartsniper-pro-root")) return null;
    var host = document.createElement("div");
    host.id = "smartsniper-pro-root";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483646";
    document.documentElement.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = chrome.runtime.getURL("content/content.css");
    var wrap = document.createElement("div");
    wrap.className = "ss-root";
    wrap.innerHTML =
      '<div class="ss-card">' +
      '<div class="ss-header"><div class="ss-brand"><strong>SMARTSNIPER PRO</strong><span>Auto-Apply · Price History</span></div>' +
      '<button class="ss-close" type="button" aria-label="Chiudi">×</button></div>' +
      '<div class="ss-body">' +
      '<div class="ss-status" id="ss-status">Inizializzazione…</div>' +
      '<div class="ss-chart" id="ss-chart"></div>' +
      '<ul class="ss-list" id="ss-list"></ul>' +
      '<div class="ss-actions">' +
      '<button class="ss-btn" id="ss-run" type="button">Auto-Apply</button>' +
      '<button class="ss-btn secondary" id="ss-shop" type="button">Deal affiliato</button>' +
      "</div>" +
      '<div class="ss-foot" id="ss-foot">Link via AffiliateRouter.buildUrl</div>' +
      "</div></div>";
    shadow.appendChild(style);
    shadow.appendChild(wrap);
    return {
      host: host,
      shadow: shadow,
      status: shadow.getElementById("ss-status"),
      chart: shadow.getElementById("ss-chart"),
      list: shadow.getElementById("ss-list"),
      runBtn: shadow.getElementById("ss-run"),
      shopBtn: shadow.getElementById("ss-shop"),
      closeBtn: shadow.querySelector(".ss-close"),
      foot: shadow.getElementById("ss-foot")
    };
  }

  function renderResults(ui, results) {
    ui.list.innerHTML = "";
    if (!results.length) {
      ui.status.textContent = "Nessun coupon disponibile.";
      ui.status.className = "ss-status warn";
      return;
    }
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var li = document.createElement("li");
      li.className = "ss-item" + (i === 0 && r.discount > 0 ? " is-best" : "");
      li.innerHTML =
        '<div><div class="ss-code">' +
        escapeHtml(r.code) +
        '</div><div class="ss-meta">' +
        escapeHtml(r.label || "") +
        " · −€" +
        (r.discount || 0).toFixed(2) +
        " · cb " +
        (r.cashbackPercent || 0) +
        "%</div></div>" +
        '<button class="ss-btn secondary" type="button" data-code="' +
        escapeHtml(r.code) +
        '">Usa</button>';
      ui.list.appendChild(li);
    }
    var best = results[0];
    if (best && best.discount > 0) {
      ui.status.textContent = "Best: " + best.code + " (−€" + best.discount.toFixed(2) + ")";
      ui.status.className = "ss-status ok";
    } else {
      ui.status.textContent = "Nessuno sconto effettivo dopo Auto-Apply.";
      ui.status.className = "ss-status warn";
    }
  }

  async function loadHistoryForChart() {
    try {
      var feed = await ApiClient.getDealsFeed();
      var deals = Array.isArray(feed.deals) ? feed.deals : Array.isArray(feed.alerts) ? feed.alerts : [];
      if (deals.length && Array.isArray(deals[0].history)) return deals[0].history;
    } catch (e) {}
    var priceEl = queryFirst(MERCHANT_SELECTORS.demo.price);
    var now = priceEl ? parseMoney(priceEl.getAttribute("data-price") || priceEl.textContent) : 100;
    if (now == null) now = 100;
    return [
      { t: "T-3", p: round2(now * 1.35) },
      { t: "T-2", p: round2(now * 1.2) },
      { t: "T-1", p: round2(now * 1.08) },
      { t: "T0", p: now }
    ];
  }

  async function boot() {
    if (!isCheckoutContext()) return;
    var merchant = detectMerchant();
    if (merchant === "unknown") merchant = "demo";
    var ui = injectOverlay();
    if (!ui) return;

    ui.closeBtn.addEventListener("click", function () {
      ui.host.remove();
    });

    var history = await loadHistoryForChart();
    ui.chart.innerHTML = buildPriceHistorySvg(history);

    var couponPayload = { coupons: [] };
    try {
      couponPayload = await ApiClient.getCoupons(merchant);
    } catch (e) {
      couponPayload = { coupons: [] };
    }
    var coupons = Array.isArray(couponPayload.coupons) ? couponPayload.coupons : [];
    ui.status.textContent = "Merchant " + merchant + " · " + coupons.length + " codici pronti";
    ui.status.className = "ss-status";
    renderResults(
      ui,
      coupons.map(function (c) {
        return { code: c.code, label: c.label, cashbackPercent: c.cashbackPercent, discount: 0 };
      })
    );

    ui.list.addEventListener("click", async function (ev) {
      var btn = ev.target.closest("button[data-code]");
      if (!btn) return;
      var code = btn.getAttribute("data-code");
      var selectors = MERCHANT_SELECTORS[merchant] || MERCHANT_SELECTORS.demo;
      var result = await tryCoupon(code, selectors);
      ui.status.textContent = result.ok
        ? "Applicato " + code + " (−€" + result.discount.toFixed(2) + ")"
        : "Nessun effetto per " + code;
      ui.status.className = "ss-status " + (result.ok ? "ok" : "warn");
      var match = null;
      for (var i = 0; i < coupons.length; i++) {
        if (coupons[i].code === code) {
          match = coupons[i];
          break;
        }
      }
      chrome.runtime.sendMessage({
        type: "RECORD_DEAL",
        deal: {
          type: "coupon",
          code: code,
          merchant: merchant,
          discount: result.discount,
          url: location.href,
          cashbackPercent: match ? match.cashbackPercent || 0 : 0
        }
      });
    });

    ui.runBtn.addEventListener("click", async function () {
      ui.runBtn.disabled = true;
      ui.status.textContent = "Auto-Apply in corso…";
      var results = await runAutoApply(coupons, merchant);
      renderResults(ui, results);
      var best = results[0];
      if (best && best.discount > 0) {
        var selectors = MERCHANT_SELECTORS[merchant] || MERCHANT_SELECTORS.demo;
        await tryCoupon(best.code, selectors);
        chrome.runtime.sendMessage({
          type: "RECORD_DEAL",
          deal: {
            type: "coupon_auto",
            code: best.code,
            merchant: merchant,
            discount: best.discount,
            url: location.href,
            cashbackPercent: best.cashbackPercent || 0
          }
        });
      }
      ui.runBtn.disabled = false;
    });

    ui.shopBtn.addEventListener("click", function () {
      chrome.runtime.sendMessage(
        { type: "BUILD_AFFILIATE_URL", url: location.href, merchant: merchant, subId: "overlay_cta" },
        function (resp) {
          var url =
            resp && resp.url
              ? resp.url
              : AffiliateRouter.buildUrl(location.href, merchant, { subId: "overlay_cta" });
          ui.foot.innerHTML =
            'Affiliato: <a class="ss-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">apri</a>';
          window.open(url, "_blank", "noopener");
        }
      );
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
