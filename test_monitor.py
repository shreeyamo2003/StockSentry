
from monitor import refresh_all_prices

results = refresh_all_prices()

if not results:
    print("No holdings found. Add a stock through StockSentry first.")

for result in results:
    if result["success"]:
        print(
            f'{result["symbol"]}: ₹{result["price"]:.2f} '
            f'({result["price_type"]})'
        )
    else:
        print(
            f'Stock ID {result["stock_id"]}: '
            f'{result["message"]}'
        )
