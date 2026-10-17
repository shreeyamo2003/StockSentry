
import io
import logging
import time

import pandas as pd
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

NSE_SECURITIES_URL = (
    "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
)

_session = requests.Session()
_session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "text/csv,text/plain,*/*",
    "Referer": "https://www.nseindia.com/",
})

_cache = {"stocks": None, "loaded_at": 0}
CACHE_SECONDS = 24 * 60 * 60


def discover_nse_stocks():
    """Download the NSE equity list and cache it for 24 hours."""
    if (
        _cache["stocks"] is not None
        and time.time() - _cache["loaded_at"] < CACHE_SECONDS
    ):
        return _cache["stocks"].copy()

    response = _session.get(NSE_SECURITIES_URL, timeout=20)
    response.raise_for_status()

    df = pd.read_csv(io.BytesIO(response.content))
    df.columns = [str(column).strip().upper() for column in df.columns]

    required = {"SYMBOL", "NAME OF COMPANY", "SERIES"}
    if not required.issubset(df.columns):
        raise ValueError(
            f"Unexpected NSE CSV columns: {list(df.columns)}"
        )

    # Keep ordinary equity shares; exclude ETFs and other instruments.
    df["SERIES"] = df["SERIES"].astype(str).str.strip()
    df = df[df["SERIES"] == "EQ"].copy()

    df["SYMBOL"] = df["SYMBOL"].astype(str).str.strip()
    df["NAME OF COMPANY"] = (
        df["NAME OF COMPANY"].astype(str).str.strip()
    )

    df = df[
        df["SYMBOL"].str.fullmatch(r"[A-Z0-9&-]+", na=False)
    ]

    stocks = df[["SYMBOL", "NAME OF COMPANY"]].drop_duplicates(
        subset=["SYMBOL"]
    )

    _cache["stocks"] = stocks.reset_index(drop=True)
    _cache["loaded_at"] = time.time()

    return _cache["stocks"].copy()


def get_stock_price(symbol):
    """Fetch recent daily closing prices for one discovered NSE symbol."""
    ticker = yf.Ticker(f"{symbol}.NS")
    history = ticker.history(period="5d", interval="1d")

    if history.empty:
        return None

    closes = history["Close"].dropna()
    if closes.empty:
        return None

    latest = float(closes.iloc[-1])
    previous = float(closes.iloc[-2]) if len(closes) > 1 else latest

    if latest <= 0 or previous <= 0:
        return None

    return {
        "symbol": symbol,
        "price": round(latest, 2),
        "change": round(latest - previous, 2),
        "change_pct": round((latest - previous) / previous * 100, 2),
    }
if __name__ == "__main__":
    stocks = discover_nse_stocks()
    print(f"Discovered {len(stocks)} NSE equity stocks")
    print(stocks.head(10).to_string(index=False))