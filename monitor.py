
from datetime import datetime
from database import get_connection
from prices import fetch_stock_price


def refresh_stock_price(stock_id):
    """Fetch and save the latest available price for one holding."""
    connection = get_connection()

    try:
        stock = connection.execute(
            "SELECT id, symbol, exchange FROM stocks WHERE id = ?",
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

            return {
                "success": True,
                "stock_id": stock_id,
                "symbol": result["symbol"],
                "price": result["price"],
                "timestamp": result["timestamp"],
                "price_type": result["price_type"]
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
