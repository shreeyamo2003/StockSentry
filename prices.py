
import yfinance as yf


def get_yfinance_ticker(symbol, exchange):
    """Convert a stock symbol into the Yahoo Finance ticker format."""
    symbol = symbol.strip().upper()
    exchange = exchange.strip().upper()

    if exchange == "NSE":
        return f"{symbol}.NS"
    elif exchange == "BSE":
        return f"{symbol}.BO"
    else:
        raise ValueError("Exchange must be NSE or BSE.")


def fetch_stock_price(symbol, exchange):
    """
    Fetch the latest available market price.

    Prefer intraday data when available. If unavailable,
    fall back to the latest daily closing price.
    """
    ticker_symbol = get_yfinance_ticker(symbol, exchange)
    ticker = yf.Ticker(ticker_symbol)

    # First attempt: latest available intraday price
    try:
        history = ticker.history(
            period="1d",
            interval="1m",
            auto_adjust=False
        )

        if not history.empty:
            history = history.dropna(subset=["Close"])

            if not history.empty:
                latest = history.iloc[-1]

                return {
                    "symbol": symbol.upper(),
                    "ticker": ticker_symbol,
                    "price": round(float(latest["Close"]), 2),
                    "timestamp": history.index[-1].isoformat(),
                    "price_type": "intraday"
                }

    except Exception:
        pass

    # Fallback: latest available daily closing price
    try:
        history = ticker.history(
            period="5d",
            interval="1d",
            auto_adjust=False
        )

        if not history.empty:
            history = history.dropna(subset=["Close"])

            if not history.empty:
                latest = history.iloc[-1]

                return {
                    "symbol": symbol.upper(),
                    "ticker": ticker_symbol,
                    "price": round(float(latest["Close"]), 2),
                    "timestamp": history.index[-1].isoformat(),
                    "price_type": "daily_close"
                }

    except Exception as error:
        raise RuntimeError(
            f"Could not fetch price for {ticker_symbol}: {error}"
        ) from error

    raise RuntimeError(
        f"No usable price data was returned for {ticker_symbol}."
    )
