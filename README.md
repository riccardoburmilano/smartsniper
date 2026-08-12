# SmartSniper Pro — Chrome Extension MVP (Manifest V3)

Estensione enterprise **affiliate-first** per coupon, cashback e arbitraggio commerciale.
Vanilla HTML/CSS/JS, nessuna dipendenza npm.

## Cosa fa

1. **AffiliateRouter** — ogni CTA, notifica e link acquisto passa da `AffiliateRouter.buildAffiliateUrl(originalUrl, merchant)` (Amazon Associates, Awin, TradeDoubler, eBay Partner Network).
2. **Cloud delegation** — il browser non fa scraping aggressivo: `utils/api-client.js` parla con un backend mock/live (`/v1/alerts`, `/v1/price/quote`, `/v1/coupons`, `/v1/webhooks/dispatch`) con cache **Stale-While-Revalidate**.
3. **ROI netto reale** — `ArbitrageCalculator` calcola  
   `(FMV − 13% fee − spedizione venditore − (acquisto + spedizione inbound)) / (acquisto + inbound)`.  
   Se ROI netto **&lt; 25%** l’alert non viene inviato.
4. **Checkout Auto-Apply** — content script in Shadow DOM prova i coupon con eventi nativi (`input`/`change`/`click`) su Amazon, eBay, Zalando, MediaWorld, Unieuro e demo locale.

## Struttura

```
.
├── manifest.json
├── background/background.js
├── content/content.js
├── content/content.css
├── popup/popup.html
├── popup/popup.css
├── popup/popup.js
├── utils/affiliate.js
├── utils/api-client.js
├── rules/affiliate_safety.json
├── icons/
├── demo/
│   ├── product-demo.html
│   └── checkout-demo.html
└── README.md
```

## Installazione (Load unpacked)

1. Apri Chrome → `chrome://extensions/`
2. Attiva **Developer mode**
3. Clicca **Load unpacked**
4. Seleziona la **root** di questo repository (cartella che contiene `manifest.json`)
5. Pinna SmartSniper Pro nella toolbar
6. Alla prima notifica, consenti le notification di sistema

## Test rapido — Auto-Apply coupon

### Opzione A — file locale

1. Apri `demo/checkout-demo.html` (doppio click o trascina in Chrome)
2. Comparirà l’overlay **SmartSniper Pro** in basso a destra
3. Premi **Auto-Apply**
4. Verifica che il totale scenda con il codice migliore (`SNIPER25`)
5. Apri il popup → tab **Coupon & Cashback**

### Opzione B — server locale (consigliata)

```bash
cd /path/to/smartsniper
python3 -m http.server 8765
```

Apri:

- Checkout: http://127.0.0.1:8765/demo/checkout-demo.html
- Prodotto: http://127.0.0.1:8765/demo/product-demo.html

## Test rapido — Hot Deals / Arbitraggio

1. Apri `demo/product-demo.html` e copia l’URL
2. Popup → tab **Hot Deals / Arbitraggio**
3. Incolla URL → **Aggiungi al monitor**
4. Premi **Controlla Ora**
5. Se ROI netto ≥ 25% ricevi notifica desktop + card deal (link già affiliato)
6. Cliccando la notifica si apre l’URL passato da `AffiliateRouter`

## Webhook Telegram / Discord

1. Popup → tab **Webhook & Settings**
2. Compila token/chat Telegram e/o webhook Discord
3. Salva → **Test webhook**
4. Ad ogni alert qualificato il service worker dispatcha anche i webhook configurati

## Architettura di produzione

| Layer | Ruolo |
|-------|--------|
| Extension (MV3) | UI, overlay checkout, alarm leggero, notifiche |
| `AffiliateRouter` | Monetizzazione centralizzata + SubID |
| Backend API | Proxy anti-bot, price intelligence, cache SWR, alert pronti |
| Webhooks | Fan-out Telegram/Discord per ops / community |

Endpoint backend previsti:

- `GET /v1/health`
- `GET /v1/coupons?merchant=`
- `POST /v1/price/quote`
- `GET /v1/alerts`
- `POST /v1/watch`
- `POST /v1/webhooks/dispatch`

In MVP la modalità default è **`apiMode=mock`** (risposte strutturate in-extension). Passa a **live** nelle settings quando `https://api.smartsniper.pro` è online.

Il service worker usa `chrome.alarms` **solo** per polling backend ogni 15 minuti: nessun crawl merchant lato client.

## Permessi

- `storage` — settings, watchlist, deal sessione
- `alarms` — sync periodico backend
- `notifications` — alert ROI qualificati
- `declarativeNetRequest` — header client verso API
- `activeTab` — azioni contestuali

## Licenza

MVP dimostrativo — uso libero per sperimentazione e staging.
