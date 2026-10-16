# from flask import Flask, render_template

# app = Flask(__name__)


# @app.route("/")
# def home():
#     return render_template("index.html")


# if __name__ == "__main__":
#     # use_reloader=False keeps the scheduler from starting twice later on
#     app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)

from monitor import refresh_all_prices
from calculations import (
    calculate_invested_value,
    calculate_current_value,
    calculate_profit_loss,
    calculate_return_percentage,
)
from flask import Flask, render_template, request, jsonify
from database import init_db, get_connection

app = Flask(__name__)

# Create the database tables on startup
init_db()


def validate_stock(data):
    required = [
        "company_name", "symbol", "exchange",
        "quantity", "buy_price", "target_min", "target_max"
    ]

    for field in required:
        if data.get(field) is None or str(data[field]).strip() == "":
            return f"{field} is required."

    if data["exchange"] not in ("NSE", "BSE"):
        return "Exchange must be NSE or BSE."

    try:
        quantity = int(data["quantity"])
        buy_price = float(data["buy_price"])
        target_min = float(data["target_min"])
        target_max = float(data["target_max"])
        near_pct = float(data.get("near_pct", 5))
    except (ValueError, TypeError):
        return "Quantity and prices must be valid numbers."

    if quantity <= 0:
        return "Quantity must be greater than zero."
    if any(price <= 0 for price in (buy_price, target_min, target_max)):
        return "Buy price and target prices must be greater than zero."
    if target_max < target_min:
        return "Maximum target must be greater than or equal to minimum target."
    if not 0 <= near_pct <= 100:
        return "Near-target percentage must be between 0 and 100."

    return None


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/holdings", methods=["GET"])
def list_holdings():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stocks ORDER BY id DESC"
        ).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/holdings", methods=["POST"])
def add_holding():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    error = validate_stock(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO stocks (
                    company_name, symbol, exchange, quantity,
                    buy_price, buy_date, target_min, target_max,
                    near_pct, email_alerts, alert_email
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data["company_name"].strip(),
                data["symbol"].strip().upper(),
                data["exchange"],
                int(data["quantity"]),
                float(data["buy_price"]),
                data.get("buy_date") or None,
                float(data["target_min"]),
                float(data["target_max"]),
                float(data.get("near_pct", 5)),
                int(bool(data.get("email_alerts", False))),
                data.get("alert_email") or None
            ))
            stock_id = cursor.lastrowid

        return jsonify({
            "message": "Stock added successfully.",
            "id": stock_id
        }), 201

    except Exception:
        app.logger.exception("Could not add holding")
        return jsonify({"error": "Could not save the stock."}), 500


@app.route("/api/holdings/<int:stock_id>", methods=["PUT"])
def update_holding(stock_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    error = validate_stock(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as conn:
            cursor = conn.execute("""
                UPDATE stocks SET
                    company_name = ?, symbol = ?, exchange = ?,
                    quantity = ?, buy_price = ?, buy_date = ?,
                    target_min = ?, target_max = ?, near_pct = ?,
                    email_alerts = ?, alert_email = ?
                WHERE id = ?
            """, (
                data["company_name"].strip(),
                data["symbol"].strip().upper(),
                data["exchange"],
                int(data["quantity"]),
                float(data["buy_price"]),
                data.get("buy_date") or None,
                float(data["target_min"]),
                float(data["target_max"]),
                float(data.get("near_pct", 5)),
                int(bool(data.get("email_alerts", False))),
                data.get("alert_email") or None,
                stock_id
            ))

            if cursor.rowcount == 0:
                return jsonify({"error": "Stock not found."}), 404

        return jsonify({"message": "Stock updated successfully."})

    except Exception:
        app.logger.exception("Could not update holding")
        return jsonify({"error": "Could not update the stock."}), 500


@app.route("/api/holdings/<int:stock_id>", methods=["DELETE"])
def delete_holding(stock_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM stocks WHERE id = ?", (stock_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Stock not found."}), 404

    return jsonify({"message": "Stock deleted successfully."})


@app.route("/api/portfolio", methods=["GET"])
def portfolio_summary():
    # Refresh the prices of all saved holdings.
    try:
        refresh_all_prices()
    except Exception:
        app.logger.exception("Could not refresh all stock prices")

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stocks ORDER BY id DESC"
        ).fetchall()

    holdings = []
    total_invested = 0.0
    priced_invested = 0.0
    total_current_value = 0.0
    total_profit_loss = 0.0
    priced_count = 0

    for row in rows:
        stock = dict(row)

        quantity = stock["quantity"]
        buy_price = stock["buy_price"]
        current_price = stock["last_price"]

        invested_value = calculate_invested_value(
            quantity, buy_price
        )
        total_invested += invested_value

        if current_price is not None:
            current_value = calculate_current_value(
                quantity, current_price
            )
            profit_loss = calculate_profit_loss(
                quantity, buy_price, current_price
            )
            return_percentage = calculate_return_percentage(
                buy_price, current_price
            )

            priced_invested += invested_value
            total_current_value += current_value
            total_profit_loss += profit_loss
            priced_count += 1
        else:
            current_value = None
            profit_loss = None
            return_percentage = None

        stock.update({
            "invested_value": round(invested_value, 2),
            "current_value": (
                round(current_value, 2)
                if current_value is not None else None
            ),
            "profit_loss": (
                round(profit_loss, 2)
                if profit_loss is not None else None
            ),
            "return_percentage": (
                round(return_percentage, 2)
                if return_percentage is not None else None
            ),
        })

        holdings.append(stock)

    overall_return = (
        (total_profit_loss / priced_invested) * 100
        if priced_invested > 0 else None
    )

    return jsonify({
        "summary": {
            "total_holdings": len(holdings),
            "priced_holdings": priced_count,
            "total_invested_value": round(total_invested, 2),
            "priced_invested_value": round(priced_invested, 2),
            "current_value": round(total_current_value, 2),
            "profit_loss": round(total_profit_loss, 2),
            "return_percentage": (
                round(overall_return, 2)
                if overall_return is not None else None
            ),
        },
        "holdings": holdings,
    })




if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
