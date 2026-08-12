# SmartSniper Pro — Chrome Extension MVP (Manifest V3)

Estensione **vanilla** HTML/CSS/JS. Zero npm, zero librerie esterne.

## Installazione (Load unpacked)

1. Apri Chrome → `chrome://extensions/`
2. Attiva **Developer mode**
3. Clicca **Load unpacked**
4. Seleziona la root di questo repository (cartella con `manifest.json`)
5. Pinna SmartSniper Pro nella toolbar

## Test rapido — Auto-Apply coupon

Opzione A (file locale):

1. Apri `demo/checkout-demo.html`
2. Compare l’overlay SmartSniper Pro (Shadow DOM)
3. Premi **Auto-Apply**
4. Il totale scende con `SNIPER25`

Opzione B (server locale):

```bash
python3 -m http.server 8765
```

Apri:

- Checkout: http://127.0.0.1:8765/demo/checkout-demo.html
- Prodotto: http://127.0.0.1:8765/demo/product-demo.html

## Test rapido — Deals / ROI

1. Apri il popup → tab **Deals**
2. Premi **Controlla Ora**
3. Se ROI netto ≥ 25% vedi le card e (al primo sync) una notifica desktop
4. I link passano da `AffiliateRouter.buildUrl(url, merchant)`

## Struttura

```
manifest.json
background/background.js
content/content.js
content/content.css
popup/popup.html
popup/popup.css
popup/popup.js
utils/affiliate.js
utils/api-client.js
demo/product-demo.html
demo/checkout-demo.html
README.md
```

## Note

- Polling mock backend ogni 15 minuti via `chrome.alarms`
- Cache API: Stale-While-Revalidate in `chrome.storage.local`
- ROI = `(FMV − 13% fee − spedizione outbound − (acquisto + inbound)) / (acquisto + inbound)`
