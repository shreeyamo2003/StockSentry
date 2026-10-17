
from datetime import datetime
from database import get_connection
from prices import fetch_stock_price


def check_target_status(stock, current_price):
    """Classify the latest price against the stock's target range."""
    target_min = float(stock["target_min"])
    target_max = float(stock["target_max"])
    near_pct = float(stock["near_pct"] or 5)

    if target_min <= current_price <= target_max:
        return "TARGET_REACHED"

    # Calculate the approach distance using the nearest target boundary.
    if current_price < target_min:
        approach_threshold = target_min * (1 - near_pct / 100)

        if current_price >= approach_threshold:
            return "APPROACHING_TARGET"

    elif current_price > target_max:
        return "ABOVE_TARGET"

    return "OUTSIDE_TARGET"


def refresh_stock_price(stock_id):
    """Fetch and save the latest available price for one holding."""
    connection = get_connection()

    try:
        stock = connection.execute(
            """
            SELECT id, symbol, exchange, target_min, target_max, near_pct
            FROM stocks
            WHERE id = ?
            """,
            (stock_id,)
        ).fetchone()


        if stock is None:
            return {"success": False, "message": "Stock not found."}

        try:
            result = fetch_stock_price(
                stock["symbol"],
                stock["exchange"]
            )

            connection.execute(
                """
                UPDATE stocks
                SET last_price = ?,
                    last_price_updated = ?,
                    price_is_stale = 0
                WHERE id = ?
                """,
                (result["price"], result["timestamp"], stock_id)
            )
            connection.commit()

             
            target_status = check_target_status(
                stock,
                float(result["price"])
            )

            return {
                "success": True,
                "stock_id": stock_id,
                "symbol": result["symbol"],
                "price": result["price"],
                "timestamp": result["timestamp"],
                "price_type": result["price_type"],
                "target_status": target_status
            }

        except Exception as error:
            # Keep the last known price, but mark it as stale.
            connection.execute(
                """
                UPDATE stocks
                SET price_is_stale = 1
                WHERE id = ?
                """,
                (stock_id,)
            )
            connection.commit()

            return {
                "success": False,
                "stock_id": stock_id,
                "message": str(error)
            }

    finally:
        connection.close()


def refresh_all_prices():
    """Refresh every holding saved in SQLite."""
    connection = get_connection()

    try:
        rows = connection.execute(
            "SELECT id FROM stocks ORDER BY id"
        ).fetchall()
        stock_ids = [row["id"] for row in rows]
    finally:
        connection.close()

    return [
        refresh_stock_price(stock_id)
        for stock_id in stock_ids
    ]
