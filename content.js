/**
 * SmartSniper — Content script
 * Detects checkout / cart pages and shows a discreet coupon & cashback overlay.
 */

(function SmartSniperContent() {
  if (window.__smartSniperLoaded) return;
  window.__smartSniperLoaded = true;

  const CHECKOUT_HINTS = [
    /\/checkout/i,
    /\/gp\/buy/i,
    /\/cart/i,
    /\/basket/i,
    /\/bag/i,
    /\/ordine/i,
    /\/payment/i,
    /\/pay\b/i,
    /checkout-demo\.html/i,
  ];

  const COUPON_CATALOG = {
    amazon: [
      {
        code: "SAVE10AMZ",
        label: "10% sul carrello",
        discount: "−10%",
        cashback: "2%",
      },
      {
        code: "PRIMEFREIGHT",
        label: "Spedizione agevolata",
        discount: "Spedizione −€4",
        cashback: "1%",
      },
    ],
    ebay: [
      {
        code: "EBAY15OFF",
        label: "15% su elettronica",
        discount: "−15%",
        cashback: "3%",
      },
      {
        code: "CASHBACK5",
        label: "Cashback checkout",
        discount: "",
        cashback: "5%",
      },
    ],
    zalando: [
      {
        code: "ZALA20",
        label: "20% primo ordine",
        discount: "−20%",
        cashback: "2%",
      },
    ],
    mediaworld: [
      {
        code: "MWEXTRA5",
        label: "Extra sconto tech",
        discount: "−5%",
        cashback: "4%",
      },
    ],
    unieuro: [
      {
        code: "UNI10",
        label: "10% selezioni",
        discount: "−10%",
        cashback: "2%",
      },
    ],
    demo: [
      {
        code: "SNIPERDEMO",
        label: "Demo coupon SmartSniper",
        discount: "−25%",
        cashback: "5%",
      },
      {
        code: "CASHBACKTEST",
        label: "Cashback di prova",
        discount: "−€5",
        cashback: "8%",
      },
    ],
    generic: [
      {
        code: "WELCOME5",
        label: "Codice generico MVP",
        discount: "−5%",
        cashback: "1%",
      },
    ],
  };

  function detectMerchant(hostname, href) {
    const h = (hostname || "").toLowerCase();
    if (h.includes("amazon.")) return "amazon";
    if (h.includes("ebay.")) return "ebay";
    if (h.includes("zalando.")) return "zalando";
    if (h.includes("mediaworld.")) return "mediaworld";
    if (h.includes("unieuro.")) return "unieuro";
    if (/checkout-demo\.html/i.test(href) || /product-demo\.html/i.test(href)) return "demo";
    return "generic";
  }

  function isCheckoutPage(href) {
    return CHECKOUT_HINTS.some((re) => re.test(href));
  }

  function merchantLabel(key) {
    const map = {
      amazon: "Amazon",
      ebay: "eBay",
      zalando: "Zalando",
      mediaworld: "MediaWorld",
      unieuro: "Unieuro",
      demo: "Demo Store",
      generic: "Questo store",
    };
    return map[key] || key;
  }

  function shouldShow() {
    const href = location.href;
    // Always show on demo checkout; otherwise require checkout-like path
    if (/checkout-demo\.html/i.test(href)) return true;
    if (/product-demo\.html/i.test(href)) return false;
    return isCheckoutPage(href);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        return true;
      } catch {
        return false;
      } finally {
        ta.remove();
      }
    }
  }

  function mountOverlay(merchant, coupons) {
    if (document.getElementById("smartsniper-root")) return;

    const root = document.createElement("div");
    root.id = "smartsniper-root";
    root.setAttribute("data-smartsniper", "1");

    const panel = document.createElement("div");
    panel.className = "ss-panel";

    panel.innerHTML = `
      <div class="ss-head">
        <div class="ss-brand"><span></span>SmartSniper</div>
        <button type="button" class="ss-close" aria-label="Chiudi">×</button>
      </div>
      <div class="ss-body">
        <p class="ss-sub">Coupon e cashback attivi per <strong>${merchantLabel(
          merchant
        )}</strong>. Clicca Applica per copiare il codice.</p>
        <ul class="ss-list"></ul>
        <div class="ss-toast" aria-live="polite"></div>
      </div>
    `;

    const list = panel.querySelector(".ss-list");
    const toast = panel.querySelector(".ss-toast");

    for (const coupon of coupons) {
      const li = document.createElement("li");
      li.className = "ss-item";
      const metaParts = [coupon.discount, coupon.cashback ? `Cashback ${coupon.cashback}` : ""]
        .filter(Boolean)
        .join(" · ");
      li.innerHTML = `
        <div class="ss-item-info">
          <p class="ss-item-title">${coupon.label}</p>
          <p class="ss-item-meta"><span class="ss-code">${coupon.code}</span>${
        metaParts ? ` · ${metaParts}` : ""
      }</p>
        </div>
        <button type="button" class="ss-apply">Applica</button>
      `;
      const btn = li.querySelector(".ss-apply");
      btn.addEventListener("click", async () => {
        const ok = await copyText(coupon.code);
        btn.textContent = "Copiato";
        btn.classList.add("is-done");
        toast.textContent = ok
          ? `Codice ${coupon.code} copiato negli appunti.`
          : `Codice: ${coupon.code} (copia manuale)`;

        try {
          await chrome.runtime.sendMessage({
            type: "SAVE_SESSION_DEAL",
            merchant: merchantLabel(merchant),
            code: coupon.code,
            label: coupon.label,
            discount: coupon.discount,
            cashback: coupon.cashback,
            pageUrl: location.href,
          });
        } catch (err) {
          console.warn("[SmartSniper] save deal failed", err);
        }

        setTimeout(() => {
          btn.textContent = "Applica";
          btn.classList.remove("is-done");
        }, 2000);
      });
      list.appendChild(li);
    }

    panel.querySelector(".ss-close").addEventListener("click", () => {
      root.remove();
      sessionStorage.setItem("smartsniper_dismissed", "1");
    });

    root.appendChild(panel);
    document.documentElement.appendChild(root);
  }

  function init() {
    if (!shouldShow()) return;
    if (sessionStorage.getItem("smartsniper_dismissed") === "1") return;

    const merchant = detectMerchant(location.hostname, location.href);
    const coupons = COUPON_CATALOG[merchant] || COUPON_CATALOG.generic;
    if (!coupons.length) return;

    if (document.body) {
      mountOverlay(merchant, coupons);
    } else {
      document.addEventListener("DOMContentLoaded", () => mountOverlay(merchant, coupons), {
        once: true,
      });
    }
  }

  init();
})();
