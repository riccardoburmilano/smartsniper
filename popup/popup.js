/* global AffiliateRouter, ApiClient */
(function () {
  "use strict";

  var dealsList = document.getElementById("deals-list");
  var dealsMeta = document.getElementById("deals-meta");
  var couponList = document.getElementById("coupon-list");
  var syncStatus = document.getElementById("sync-status");
  var btnSync = document.getElementById("btn-sync");
  var btnWatch = document.getElementById("btn-watch");
  var merchantSelect = document.getElementById("coupon-merchant");

  function euro(n) {
    return "€" + Number(n || 0).toFixed(2);
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      var active = tab.getAttribute("data-tab") === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach(function (panel) {
      var active = panel.id === "panel-" + name;
      panel.classList.toggle("active", active);
      if (active) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      setTab(tab.getAttribute("data-tab"));
    });
  });

  function renderDeals(deals, lastSync) {
    dealsList.innerHTML = "";
    if (!deals || !deals.length) {
      dealsList.innerHTML = '<p class="empty">Nessun hot deal con ROI netto ≥ 25%. Premi Controlla Ora.</p>';
    } else {
      deals.forEach(function (deal) {
        var arb = deal.arbitrage || {};
        var url = deal.url || "";
        if (!url && deal.productId === "ss-demo-sony-wh1000") {
          url = chrome.runtime.getURL("demo/product-demo.html");
        }
        var aff = url
          ? AffiliateRouter.buildUrl(url, deal.merchant, { subId: "popup_deals" })
          : "";
        var card = document.createElement("article");
        card.className = "card";
        card.innerHTML =
          "<h3></h3>" +
          "<p></p>" +
          '<span class="badge"></span>' +
          (aff ? '<div style="margin-top:8px"><a class="deal-link" target="_blank" rel="noopener"></a></div>' : "");
        card.querySelector("h3").textContent = deal.title || "Deal";
        card.querySelector("p").textContent =
          "Acquisto " +
          euro(deal.purchasePrice) +
          " · FMV " +
          euro(deal.fairMarketValue) +
          " · Netto " +
          euro(arb.profit);
        card.querySelector(".badge").textContent = "ROI " + (arb.roiNetPercent || 0) + "%";
        if (aff) {
          var a = card.querySelector("a.deal-link");
          a.href = aff;
          a.textContent = "Apri link affiliato";
        }
        dealsList.appendChild(card);
      });
    }
    dealsMeta.textContent = lastSync
      ? "Ultimo sync: " + new Date(lastSync).toLocaleString()
      : "Nessun sync ancora";
  }

  function renderCoupons(coupons) {
    couponList.innerHTML = "";
    if (!coupons || !coupons.length) {
      couponList.innerHTML = '<p class="empty">Nessun coupon per questo merchant.</p>';
      return;
    }
    coupons.forEach(function (c) {
      var card = document.createElement("article");
      card.className = "card";
      card.innerHTML = "<h3></h3><p></p>";
      card.querySelector("h3").textContent = c.code;
      card.querySelector("p").textContent =
        (c.label || c.type) +
        (c.type === "percent" ? " · " + c.value + "%" : c.type === "fixed" ? " · " + euro(c.value) : "");
      couponList.appendChild(card);
    });
  }

  function loadDeals() {
    chrome.runtime.sendMessage({ type: "SSPRO_GET_DEALS" }, function (res) {
      if (chrome.runtime.lastError) {
        ApiClient.getAlerts().then(function (r) {
          renderDeals((r.data && r.data.alerts) || [], Date.now());
        });
        return;
      }
      renderDeals((res && res.deals) || [], res && res.lastSync);
    });
  }

  function loadCoupons() {
    var merchant = merchantSelect.value || "demo";
    chrome.runtime.sendMessage({ type: "SSPRO_GET_COUPONS", merchant: merchant, force: true }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok) {
        ApiClient.getCoupons(merchant, { force: true }).then(function (r) {
          renderCoupons((r.data && r.data.coupons) || []);
        });
        return;
      }
      renderCoupons(res.coupons || []);
    });
  }

  btnSync.addEventListener("click", function () {
    btnSync.disabled = true;
    syncStatus.textContent = "Sync in corso…";
    chrome.runtime.sendMessage({ type: "SSPRO_SYNC_NOW" }, function (res) {
      btnSync.disabled = false;
      if (chrome.runtime.lastError || !res || !res.ok) {
        syncStatus.textContent = "Sync fallita";
        return;
      }
      syncStatus.textContent = "Trovati " + (res.count || 0) + " deal qualificati";
      renderDeals(res.deals || [], Date.now());
    });
  });

  btnWatch.addEventListener("click", function () {
    var url = document.getElementById("watch-url").value.trim();
    var buy = Number(document.getElementById("watch-buy").value);
    var fmv = Number(document.getElementById("watch-fmv").value);
    if (!url) {
      syncStatus.textContent = "Inserisci un URL valido";
      return;
    }
    var payload = {
      url: url,
      merchant: AffiliateRouter.detectMerchant(url),
      purchasePrice: Number.isFinite(buy) ? buy : undefined,
      fairMarketValue: Number.isFinite(fmv) ? fmv : undefined,
      title: url,
      productId: "watch-" + Date.now()
    };
    chrome.runtime.sendMessage({ type: "SSPRO_ADD_WATCH", payload: payload }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok) {
        syncStatus.textContent = "Watchlist non salvata";
        return;
      }
      syncStatus.textContent = "URL aggiunto al monitor";
      document.getElementById("watch-url").value = "";
    });
  });

  merchantSelect.addEventListener("change", loadCoupons);

  loadDeals();
  loadCoupons();
})();
