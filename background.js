/**
 * SmartSniper — Background Service Worker (Manifest V3)
 * Polls watched product URLs via chrome.alarms and fires desktop notifications
 * when the price drops past the configured threshold.
 */

const ALARM_NAME = "priceCheck";
const DEFAULT_POLL_MINUTES = 15;
const DEFAULT_DROP_PERCENT = 40;

const DEFAULT_SETTINGS = {
  pollMinutes: DEFAULT_POLL_MINUTES,
  defaultDropPercent: DEFAULT_DROP_PERCENT,
};

/* -------------------------------------------------------------------------- */
/* Storage helpers                                                            */
/* -------------------------------------------------------------------------- */

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(data) {
  return chrome.storage.local.set(data);
}

async function ensureDefaults() {
  const data = await getStorage(["watchedItems", "settings", "sessionDeals", "initialized"]);
  const patch = {};

  if (!Array.isArray(data.watchedItems)) {
    patch.watchedItems = [];
  }
  if (!data.settings || typeof data.settings !== "object") {
    patch.settings = { ...DEFAULT_SETTINGS };
  } else {
    patch.settings = {
      ...DEFAULT_SETTINGS,
      ...data.settings,
    };
  }
  if (!Array.isArray(data.sessionDeals)) {
    patch.sessionDeals = [];
  }
  if (!data.initialized) {
    patch.initialized = true;
  }

  if (Object.keys(patch).length) {
    await setStorage(patch);
  }
  return { ...data, ...patch };
}

/* -------------------------------------------------------------------------- */
/* Alarm lifecycle                                                            */
/* -------------------------------------------------------------------------- */

async function scheduleAlarm() {
  const { settings } = await ensureDefaults();
  const minutes = Math.max(1, Number(settings.pollMinutes) || DEFAULT_POLL_MINUTES);
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await scheduleAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await scheduleAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkAllPrices().catch((err) => console.error("[SmartSniper] price check failed", err));
  }
});

/* -------------------------------------------------------------------------- */
/* Price parsing                                                              */
/* -------------------------------------------------------------------------- */

function parsePriceNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  // European format: 1.234,56 → 1234.56
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts[1] && parts[1].length === 2) {
      s = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3 && parts.length === 2 && parts[0].length <= 3)) {
      // ambiguous thousand separator — leave as is if 2 decimal digits
      if (parts[parts.length - 1].length === 3) {
        s = s.replace(/\./g, "");
      }
    }
  }

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function extractPriceFromHtml(html, url) {
  if (!html) return { price: null, title: null };

  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null;

  const patterns = [
    /data-price=["']([0-9]+(?:[.,][0-9]+)?)["']/i,
    /id=["']price["'][^>]*>\s*€?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /itemprop=["']price["'][^>]+content=["']([0-9]+(?:[.,][0-9]+)?)["']/i,
    /content=["']([0-9]+(?:[.,][0-9]+)?)["'][^>]+itemprop=["']price["']/i,
    /property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:[.,][0-9]+)?)["']/i,
    /content=["']([0-9]+(?:[.,][0-9]+)?)["'][^>]+property=["']product:price:amount["']/i,
    /"price"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/i,
    /€\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const price = parsePriceNumber(m[1]);
      if (price != null && price > 0) {
        return { price, title };
      }
    }
  }

  // Demo page fallback: look for #price text via simple scrape
  const demoPrice = html.match(/id=["']price["'][^>]*>([^<]+)</i);
  if (demoPrice) {
    const price = parsePriceNumber(demoPrice[1]);
    if (price != null) return { price, title: title || "Demo Product" };
  }

  console.warn("[SmartSniper] Could not parse price for", url);
  return { price: null, title };
}

async function fetchProduct(url) {
  const response = await fetch(url, {
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const html = await response.text();
  return extractPriceFromHtml(html, url);
}

/* -------------------------------------------------------------------------- */
/* Price check + notifications                                                */
/* -------------------------------------------------------------------------- */

function dropPercent(baseline, current) {
  if (!baseline || baseline <= 0 || current == null) return 0;
  return ((baseline - current) / baseline) * 100;
}

async function notifyDeal(item, drop) {
  const notificationId = `deal-${item.id}-${Date.now()}`;
  const resale = item.resaleEstimate != null ? Number(item.resaleEstimate) : null;
  const profitHint =
    resale != null && Number.isFinite(resale)
      ? ` Stima rivendita: €${resale.toFixed(2)} (margine ~€${(resale - item.currentPrice).toFixed(2)}).`
      : "";

  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "SmartSniper — Deal trovato!",
    message: `${item.title || "Articolo"} a €${item.currentPrice.toFixed(2)} (−${drop.toFixed(0)}%).${profitHint}`,
    contextMessage: item.url,
    priority: 2,
  });

  // Store mapping so click opens the product URL
  const { notificationLinks = {} } = await getStorage(["notificationLinks"]);
  notificationLinks[notificationId] = item.url;
  // Keep map small
  const keys = Object.keys(notificationLinks);
  if (keys.length > 40) {
    keys.slice(0, keys.length - 40).forEach((k) => delete notificationLinks[k]);
  }
  await setStorage({ notificationLinks });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const { notificationLinks = {} } = await getStorage(["notificationLinks"]);
  const url = notificationLinks[notificationId];
  if (url) {
    await chrome.tabs.create({ url });
    chrome.notifications.clear(notificationId);
  }
});

async function checkAllPrices() {
  const { watchedItems = [], settings = DEFAULT_SETTINGS } = await ensureDefaults();
  if (!watchedItems.length) return { checked: 0, alerts: 0 };

  let alerts = 0;
  const updated = [];

  for (const item of watchedItems) {
    const next = { ...item };
    try {
      const { price, title } = await fetchProduct(item.url);
      next.lastChecked = Date.now();
      if (title && !next.title) next.title = title;
      if (title && next.title === next.url) next.title = title;

      if (price != null) {
        if (next.baselinePrice == null || next.baselinePrice <= 0) {
          next.baselinePrice = price;
        }
        next.currentPrice = price;
        next.lastError = null;

        const drop = dropPercent(next.baselinePrice, price);
        const threshold = Number(next.targetDropPercent) || settings.defaultDropPercent || DEFAULT_DROP_PERCENT;

        if (drop >= threshold) {
          // Anti-spam: notify once per price level (or if price dropped further)
          const lastNotifiedPrice = next.notifiedPrice;
          if (lastNotifiedPrice == null || price < lastNotifiedPrice - 0.01) {
            await notifyDeal(next, drop);
            next.notifiedPrice = price;
            next.notifiedAt = Date.now();
            alerts += 1;
          }
        }
      } else {
        next.lastError = "Prezzo non trovato";
      }
    } catch (err) {
      next.lastChecked = Date.now();
      next.lastError = err.message || String(err);
      console.error("[SmartSniper] fetch error", item.url, err);
    }
    updated.push(next);
  }

  await setStorage({ watchedItems: updated });
  return { checked: updated.length, alerts };
}

/* -------------------------------------------------------------------------- */
/* Messaging from popup / content scripts                                     */
/* -------------------------------------------------------------------------- */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handle = async () => {
    switch (message?.type) {
      case "CHECK_PRICES_NOW": {
        const result = await checkAllPrices();
        return { ok: true, ...result };
      }
      case "ADD_WATCHED_ITEM": {
        const { watchedItems = [], settings = DEFAULT_SETTINGS } = await ensureDefaults();
        const url = String(message.url || "").trim();
        if (!url) throw new Error("URL mancante");

        let baselinePrice = message.baselinePrice != null ? Number(message.baselinePrice) : null;
        let title = message.title || "";
        let currentPrice = baselinePrice;

        // Best-effort initial scrape
        try {
          const scraped = await fetchProduct(url);
          if (scraped.price != null) {
            currentPrice = scraped.price;
            if (baselinePrice == null) baselinePrice = scraped.price;
          }
          if (scraped.title) title = scraped.title;
        } catch (err) {
          console.warn("[SmartSniper] initial scrape failed", err);
        }

        const item = {
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          url,
          title: title || url,
          baselinePrice: baselinePrice ?? null,
          currentPrice: currentPrice ?? null,
          targetDropPercent:
            message.targetDropPercent != null
              ? Number(message.targetDropPercent)
              : settings.defaultDropPercent,
          resaleEstimate:
            message.resaleEstimate != null && message.resaleEstimate !== ""
              ? Number(message.resaleEstimate)
              : null,
          lastChecked: Date.now(),
          notifiedAt: null,
          notifiedPrice: null,
          lastError: null,
        };

        watchedItems.push(item);
        await setStorage({ watchedItems });
        return { ok: true, item };
      }
      case "REMOVE_WATCHED_ITEM": {
        const { watchedItems = [] } = await ensureDefaults();
        const next = watchedItems.filter((i) => i.id !== message.id);
        await setStorage({ watchedItems: next });
        return { ok: true };
      }
      case "SAVE_SESSION_DEAL": {
        const { sessionDeals = [] } = await ensureDefaults();
        const deal = {
          id: `deal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          merchant: message.merchant || "Unknown",
          code: message.code || "",
          label: message.label || "",
          discount: message.discount || "",
          cashback: message.cashback || "",
          pageUrl: message.pageUrl || "",
          savedAt: Date.now(),
        };
        // Avoid exact duplicates in-session
        const exists = sessionDeals.some(
          (d) => d.code === deal.code && d.merchant === deal.merchant
        );
        if (!exists) {
          sessionDeals.unshift(deal);
          await setStorage({ sessionDeals: sessionDeals.slice(0, 50) });
        }
        return { ok: true, deal };
      }
      case "CLEAR_SESSION_DEALS": {
        await setStorage({ sessionDeals: [] });
        return { ok: true };
      }
      case "UPDATE_SETTINGS": {
        const { settings = DEFAULT_SETTINGS } = await ensureDefaults();
        const next = { ...settings, ...message.settings };
        await setStorage({ settings: next });
        await scheduleAlarm();
        return { ok: true, settings: next };
      }
      case "GET_STATE": {
        const state = await ensureDefaults();
        return { ok: true, ...state };
      }
      default:
        return { ok: false, error: "Unknown message type" };
    }
  };

  handle()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // async response
});
