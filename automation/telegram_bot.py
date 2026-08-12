#!/usr/bin/env python3
"""SmartSniper Pro — zero-dependency Telegram deals publisher."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FEED_PATH = ROOT / "demo" / "deals-feed.json"
PLATFORM_FEE = 0.13
MIN_ROI = 0.30

DEFAULT_AFFILIATE = {
    "amazonTag": "smartsniper-21",
    "awinPublisherId": os.environ.get("AWIN_PUBLISHER_ID", "1234567"),
    "awinAdvertisers": {
        "zalando": "11543",
        "mediaworld": "15049",
        "unieuro": "17811",
    },
    "tradeDoublerOrgId": os.environ.get("TD_ORG_ID", "987654"),
    "tradeDoublerPrograms": {"zalando": "285084"},
    "ebayCampaignId": os.environ.get("EBAY_CAMPAIGN_ID", "5338771234"),
    "ebayCustomIdPrefix": "sspro",
}


def detect_merchant(url: str, fallback: str = "unknown") -> str:
    host = urllib.parse.urlparse(url).hostname or ""
    host = host.lower()
    if "amazon." in host:
        return "amazon"
    if "ebay." in host:
        return "ebay"
    if "zalando." in host:
        return "zalando"
    if "mediaworld." in host:
        return "mediaworld"
    if "unieuro." in host:
        return "unieuro"
    return fallback


def sanitize_sub_id(sub_id: str) -> str:
    cleaned = "".join(ch for ch in (sub_id or "organic").lower() if ch.isalnum() or ch in "_-")
    return (cleaned[:64] or "organic")


def build_url(original_url: str, merchant: Optional[str] = None, sub_id: str = "telegram") -> str:
    """Mirror of AffiliateRouter.buildUrl (Python stdlib only)."""
    merch = (merchant or detect_merchant(original_url)).lower()
    sub = sanitize_sub_id(sub_id)
    cfg = DEFAULT_AFFILIATE

    if merch == "amazon":
        parts = urllib.parse.urlsplit(original_url)
        q = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
        q["tag"] = cfg["amazonTag"]
        q["ascsubtag"] = sub
        return urllib.parse.urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(q), parts.fragment)
        )

    if merch in ("zalando", "mediaworld", "unieuro"):
        advertiser = cfg["awinAdvertisers"].get(merch, "11543")
        return (
            "https://www.awin1.com/cread.php?"
            + urllib.parse.urlencode(
                {
                    "awinmid": advertiser,
                    "awinaffid": cfg["awinPublisherId"],
                    "ued": original_url,
                    "clickref": sub,
                }
            )
        )

    if merch == "ebay":
        parts = urllib.parse.urlsplit(original_url)
        q = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
        q.update(
            {
                "mkcid": "1",
                "mkrid": "710-53481-19255-0",
                "campid": cfg["ebayCampaignId"],
                "customid": f"{cfg['ebayCustomIdPrefix']}_{sub}",
                "toolid": "10001",
                "mkevt": "1",
            }
        )
        return urllib.parse.urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(q), parts.fragment)
        )

    join = "&" if "?" in original_url else "?"
    return f"{original_url}{join}ss_aff=1&ss_sub={urllib.parse.quote(sub)}"


def calc_arbitrage(deal: Dict[str, Any]) -> Dict[str, float]:
    purchase = float(deal.get("purchasePrice") or 0)
    fmv = float(deal.get("fairMarketValue") or 0)
    nested = deal.get("arbitrage") if isinstance(deal.get("arbitrage"), dict) else {}
    inbound = float(deal["inboundShipping"] if deal.get("inboundShipping") is not None else nested.get("inboundShipping", 0) or 0)
    outbound = float(deal["outboundShipping"] if deal.get("outboundShipping") is not None else nested.get("outboundShipping", 6.5) or 6.5)
    buy_cost = purchase + inbound
    fees = fmv * PLATFORM_FEE
    sell_net = fmv - fees - outbound
    profit = sell_net - buy_cost
    roi = (profit / buy_cost) if buy_cost > 0 else 0.0
    return {
        "buyCost": round(buy_cost, 2),
        "platformFees": round(fees, 2),
        "sellNet": round(sell_net, 2),
        "profit": round(profit, 2),
        "roiNet": roi,
        "roiNetPercent": round(roi * 100, 2),
    }


def format_post(deal: Dict[str, Any], arb: Dict[str, float], affiliate_url: str) -> str:
    name = deal.get("name") or "Deal"
    purchase = float(deal.get("purchasePrice") or 0)
    fmv = float(deal.get("fairMarketValue") or 0)
    return (
        f"🔥 *{name}*\n"
        f"💸 Prezzo scontato: €{purchase:.2f}\n"
        f"📈 Valore di mercato: €{fmv:.2f}\n"
        f"💰 Profitto netto stimato: €{arb['profit']:.2f} ({arb['roiNetPercent']:.1f}%)\n"
        f"🔗 Link diretto: {affiliate_url}\n\n"
        "🚀 Trova questi errori di prezzo in automatico ogni giorno installando "
        "SmartSniper Pro (Link in Bio)"
    )


def format_social_pack(deal: Dict[str, Any], arb: Dict[str, float], affiliate_url: str) -> Dict[str, str]:
    name = deal.get("name") or "Deal"
    purchase = float(deal.get("purchasePrice") or 0)
    fmv = float(deal.get("fairMarketValue") or 0)
    cta = "Trova questi errori di prezzo in automatico ogni giorno installando SmartSniper Pro (Link in Bio)"
    telegram = format_post(deal, arb, affiliate_url)
    discord = (
        f"**{name}**\n"
        f"Prezzo scontato vs mercato: €{purchase:.2f} vs €{fmv:.2f}\n"
        f"Margine netto: €{arb['profit']:.2f} ({arb['roiNetPercent']:.1f}%)\n"
        f"{affiliate_url}\n{cta}"
    )
    twitter = (
        f"{name}\n"
        f"€{purchase:.2f} vs FMV €{fmv:.2f} | Netto €{arb['profit']:.2f} ({arb['roiNetPercent']:.0f}%)\n"
        f"{affiliate_url}\n{cta}"
    )
    tiktok = (
        f"Hook: ho trovato {name} a €{purchase:.2f} mentre sul usato vale circa €{fmv:.2f}.\n"
        f"Script: ROI netto stimato {arb['roiNetPercent']:.0f}% dopo commissioni 13% e spedizione.\n"
        f"CTA: {cta}\nLink: {affiliate_url}"
    )
    return {
        "telegram": telegram,
        "discord": discord,
        "twitter": twitter,
        "tiktok": tiktok,
    }


def send_telegram(token: str, chat_id: str, text: str) -> bool:
    endpoint = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False,
        }
    ).encode("utf-8")
    req = Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return bool(body.get("ok"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"[telegram] HTTP {exc.code}: {detail}", file=sys.stderr)
        return False
    except Exception as exc:
        print(f"[telegram] error: {exc}", file=sys.stderr)
        return False


def load_feed() -> Dict[str, Any]:
    if not FEED_PATH.exists():
        raise FileNotFoundError(f"Missing feed: {FEED_PATH}")
    return json.loads(FEED_PATH.read_text(encoding="utf-8"))


def main() -> int:
    dry_run = "--dry-run" in sys.argv or os.environ.get("TELEGRAM_DRY_RUN", "").lower() in (
        "1",
        "true",
        "yes",
    )
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

    feed = load_feed()
    deals: List[Dict[str, Any]] = list(feed.get("deals") or [])
    qualified: List[Dict[str, Any]] = []
    skipped = 0

    print(f"[scan] feed={FEED_PATH} deals={len(deals)} generatedAt={feed.get('generatedAt')}")

    for deal in deals:
        arb = calc_arbitrage(deal)
        if arb["roiNet"] <= MIN_ROI:
            skipped += 1
            print(
                f"[skip] {deal.get('id')} roi={arb['roiNetPercent']}% <= {MIN_ROI * 100:.0f}%"
            )
            continue
        merchant = deal.get("merchant") or detect_merchant(str(deal.get("url") or deal.get("originalUrl") or ""))
        raw_url = str(deal.get("url") or deal.get("originalUrl") or "")
        affiliate_url = build_url(raw_url, merchant, sub_id=f"tg_{deal.get('id', 'x')}")
        packs = format_social_pack(deal, arb, affiliate_url)
        item = {
            "id": deal.get("id"),
            "name": deal.get("name"),
            "merchant": merchant,
            "arbitrage": arb,
            "affiliateUrl": affiliate_url,
            "posts": packs,
        }
        qualified.append(item)
        print("---")
        print(packs["telegram"])
        print("---")

        if not dry_run:
            if not token or not chat_id:
                print("[fatal] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing", file=sys.stderr)
                return 2
            ok = send_telegram(token, chat_id, packs["telegram"])
            print(f"[send] {deal.get('id')} ok={ok}")
            if not ok:
                return 3
        else:
            print(f"[dry-run] would send {deal.get('id')}")

    report = {
        "scanned": len(deals),
        "qualified": len(qualified),
        "skipped": skipped,
        "dryRun": dry_run,
        "ids": [q["id"] for q in qualified],
    }
    print(f"[report] {json.dumps(report, ensure_ascii=False)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
