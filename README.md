# SmartSniper — Chrome Extension MVP (Manifest V3)

Estensione Chrome in HTML/CSS/JavaScript puro che:

1. **Rileva coupon & cashback** sulle pagine di checkout dei principali e-commerce e mostra un overlay discreto in basso a destra.
2. **Monitora i prezzi in background** (ogni 15 minuti via `chrome.alarms`) e invia una **notifica desktop** se il prezzo scende oltre la soglia configurata (default −40%), con stima di rivendita.

Nessuna dipendenza npm: carica la cartella così com’è.

## Struttura

```
.
├── manifest.json
├── background.js          # service worker: alarms, fetch prezzi, notifiche
├── popup.html / .css / .js
├── content.js / content.css
├── icons/
├── demo/
│   ├── product-demo.html  # prodotto con prezzo modificabile
│   └── checkout-demo.html # checkout finto per i coupon
└── README.md
```

## Installazione (modalità sviluppatore)

1. Apri Chrome e vai a `chrome://extensions/`.
2. Attiva **Modalità sviluppatore** (Developer mode) in alto a destra.
3. Clicca **Carica estensione non pacchettizzata** (Load unpacked).
4. Seleziona la **root** di questo repository (la cartella che contiene `manifest.json`).
5. Pinna l’icona SmartSniper nella toolbar.

### Permessi richiesti

Alla prima notifica Chrome può chiedere l’autorizzazione per le notifiche di sistema: **Consenti**.

Per testare le pagine `file://` della demo, in `chrome://extensions` → SmartSniper → dettagli, verifica che l’accesso ai file sia consentito se richiesto, oppure usa un server locale (vedi sotto).

## Test rapido — Coupon / Cashback

1. Apri il file locale:
   - percorso tipico:  
     `file:///…/smartsniper/demo/checkout-demo.html`  
   - oppure dalla cartella del progetto: doppio click su `demo/checkout-demo.html`.
2. In basso a destra compare l’overlay **SmartSniper** con codici demo.
3. Clicca **Applica** su un codice (viene copiato negli appunti).
4. Apri il popup dell’estensione → tab **Risparmi/Cashback**: il codice compare nel riepilogo sessione.

Funziona anche su URL reali di checkout/cart di Amazon, eBay, Zalando, MediaWorld, Unieuro (catalogo coupon MVP mock).

## Test rapido — Monitor prezzi & notifica

1. Apri `demo/product-demo.html` nel browser e **copia l’URL completo** dalla barra indirizzi  
   (es. `file:///home/you/.../smartsniper/demo/product-demo.html`).
2. Apri il popup SmartSniper → tab **Deal Sniper**.
3. Incolla l’URL, lascia soglia **40%**, imposta stima rivendita es. **85**, clicca **Aggiungi al monitor**.
4. Nella pagina demo imposta un prezzo basso (es. **50**) e clicca **Aggiorna prezzo sulla pagina**.
5. Nel popup clicca **Controlla ora**.
6. Dovresti ricevere una notifica desktop “SmartSniper — Deal trovato!”; il click sulla notifica apre il link prodotto.

Il controllo periodico automatico gira ogni **15 minuti** (`chrome.alarms`). Usa **Controlla ora** per non aspettare.

### Alternativa senza `file://`

```bash
cd /path/to/smartsniper   # root del repo (dove c’è manifest.json)
python3 -m http.server 8765
```

Poi monitora: `http://127.0.0.1:8765/demo/product-demo.html`  
e apri il checkout: `http://127.0.0.1:8765/demo/checkout-demo.html`.

## API Chrome usate

| API | Uso |
|-----|-----|
| `chrome.storage.local` | Articoli monitorati, settings, deal di sessione |
| `chrome.alarms` | Poll prezzi ogni 15 minuti |
| `chrome.notifications` | Alert quando il drop supera la soglia |
| `chrome.runtime` messaging | Popup ↔ service worker ↔ content script |

## Note MVP

- Il parsing del prezzo usa regex / meta comuni (`data-price`, `itemprop="price"`, `product:price:amount`, pattern `€…`). Funziona bene sulla demo; su siti reali può fallire per HTML dinamico o anti-bot.
- I coupon sono un **catalogo mock** lato client: non vengono applicati automaticamente al form del merchant.
- Nessun backend e nessuna dipendenza di build.

## Licenza

MVP dimostrativo — uso libero per sperimentazione locale.
