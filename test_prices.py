
from prices import fetch_stock_price

try:
    result = fetch_stock_price("RELIANCE", "NSE")

    print("Stock price fetched successfully!")
    print("Symbol:", result["symbol"])
    print("Yahoo Finance ticker:", result["ticker"])
    print("Latest available price: ₹", result["price"])
    print("Price timestamp:", result["timestamp"])
    print("Data type:", result["price_type"])

except Exception as error:
    print("Price fetch failed:", error)
