# SmartSniper Pro

Chrome MV3 · Vanilla JS · 0€/mese (GitHub Actions free minutes).

## Load unpacked

1. `chrome://extensions` → Developer mode ON
2. **Load unpacked** → seleziona questa root (`manifest.json`)
3. Consenti notifiche di sistema

## Test locale

```bash
python3 -m http.server 8765
```

- Checkout Auto-Apply: http://127.0.0.1:8765/demo/checkout-demo.html
- Product + chart: http://127.0.0.1:8765/demo/product-demo.html
- Popup → **Controlla Ora** (legge `demo/deals-feed.json`, alert se ROI netto > 30%)

## Telegram bot (stdlib only)

```bash
TELEGRAM_DRY_RUN=1 python3 automation/telegram_bot.py
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy python3 automation/telegram_bot.py
```

## GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Uso |
|--------|-----|
| `TELEGRAM_BOT_TOKEN` | Bot API token |
| `TELEGRAM_CHAT_ID` | Chat/channel destinazione |
| `AWIN_PUBLISHER_ID` | opzionale |
| `EBAY_CAMPAIGN_ID` | opzionale |

Workflow: `.github/workflows/daily_scan.yml` (cron 07:00 e 17:00 UTC + manual dispatch).
