# from flask import Flask, render_template

# app = Flask(__name__)


# @app.route("/")
# def home():
#     return render_template("index.html")


# if __name__ == "__main__":
#     # use_reloader=False keeps the scheduler from starting twice later on
#     app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
import yfinance as yf
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
from werkzeug.security import generate_password_hash, check_password_hash
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
app.config["SECRET_KEY"] = "20a35023c5d94279146c1255fc78d8207b083bdd5fb017d2924cb57ee5aee198"

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
# Create the database tables on startup
init_db()


class User(UserMixin):
    def __init__(self, user_id, username, password_hash):
        self.id = user_id
        self.username = username
        self.password_hash = password_hash


@login_manager.user_loader
def load_user(user_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE id = ?", (user_id,)
        ).fetchone()

    if row is None:
        return None

    return User(row["id"], row["username"], row["password_hash"])


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("analyze"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if len(username) < 3:
            flash("Username must be at least 3 characters.")
            return render_template("register.html")

        if len(password) < 8:
            flash("Password must be at least 8 characters.")
            return render_template("register.html")

        with get_connection() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE username = ?", (username,)
            ).fetchone()

            if existing:
                flash("That username is already taken.")
                return render_template("register.html")

            is_first_user = (
                conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
            )

            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, generate_password_hash(password)),
            )
            user_id = cursor.lastrowid

            # Preserve the existing portfolio by assigning it to
            # the first account created.
            if is_first_user:
                conn.execute(
                    "UPDATE stocks SET user_id = ? WHERE user_id IS NULL", (user_id,)
                )

        flash("Account created. Please log in.")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("analyze"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        with get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()

        if row and check_password_hash(row["password_hash"], password):
            user = User(row["id"], row["username"], row["password_hash"])
            login_user(user, remember=True)
            return redirect(url_for("analyze"))

        flash("Invalid username or password.")

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return redirect(url_for("home"))


def validate_stock(data):
    required = [
        "company_name",
        "symbol",
        "exchange",
        "quantity",
        "buy_price",
        "target_min",
        "target_max",
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
@login_required
def list_holdings():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stocks WHERE user_id = ? ORDER BY id DESC",
            (current_user.id,),
        ).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route("/api/holdings", methods=["POST"])
@login_required
def add_holding():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    error = validate_stock(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO stocks (
    user_id, company_name, symbol, exchange, quantity,
    buy_price, buy_date, target_min, target_max,
    near_pct, email_alerts, alert_email
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    current_user.id,
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
                ),
            )
            stock_id = cursor.lastrowid

        return jsonify({"message": "Stock added successfully.", "id": stock_id}), 201

    except Exception:
        app.logger.exception("Could not add holding")
        return jsonify({"error": "Could not save the stock."}), 500


@app.route("/api/holdings/<int:stock_id>", methods=["PUT"])
@login_required
def update_holding(stock_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    error = validate_stock(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE stocks SET
                    company_name = ?, symbol = ?, exchange = ?,
                    quantity = ?, buy_price = ?, buy_date = ?,
                    target_min = ?, target_max = ?, near_pct = ?,
                    email_alerts = ?, alert_email = ?
                WHERE id = ? AND user_id = ?
            """,
                (
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
                    stock_id,
                    current_user.id,
                ),
            )

            if cursor.rowcount == 0:
                return jsonify({"error": "Stock not found."}), 404

        return jsonify({"message": "Stock updated successfully."})

    except Exception:
        app.logger.exception("Could not update holding")
        return jsonify({"error": "Could not update the stock."}), 500


@app.route("/api/holdings/<int:stock_id>", methods=["DELETE"])
@login_required
def delete_holding(stock_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM stocks WHERE id = ? AND user_id = ?",
            (stock_id, current_user.id),
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Stock not found."}), 404

    return jsonify({"message": "Stock deleted successfully."})


@app.route("/api/portfolio", methods=["GET"])
@login_required
def portfolio_summary():
    # Refresh the prices of all saved holdings.
    try:
        refresh_all_prices()
    except Exception:
        app.logger.exception("Could not refresh all stock prices")

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stocks WHERE user_id = ? ORDER BY id DESC",
            (current_user.id,),
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

        invested_value = calculate_invested_value(quantity, buy_price)
        total_invested += invested_value

        if current_price is not None:
            current_value = calculate_current_value(quantity, current_price)
            profit_loss = calculate_profit_loss(quantity, buy_price, current_price)
            return_percentage = calculate_return_percentage(buy_price, current_price)

            priced_invested += invested_value
            total_current_value += current_value
            total_profit_loss += profit_loss
            priced_count += 1
        else:
            current_value = None
            profit_loss = None
            return_percentage = None

        stock.update(
            {
                "invested_value": round(invested_value, 2),
                "current_value": (
                    round(current_value, 2) if current_value is not None else None
                ),
                "profit_loss": (
                    round(profit_loss, 2) if profit_loss is not None else None
                ),
                "return_percentage": (
                    round(return_percentage, 2)
                    if return_percentage is not None
                    else None
                ),
                "target_status": (
                    __import__("monitor").check_target_status(
                        stock, float(current_price)
                    )
                    if current_price is not None
                    else "PRICE_UNAVAILABLE"
                ),
            }
        )

        holdings.append(stock)

    overall_return = (
        (total_profit_loss / priced_invested) * 100 if priced_invested > 0 else None
    )

    return jsonify(
        {
            "summary": {
                "total_holdings": len(holdings),
                "priced_holdings": priced_count,
                "total_invested_value": round(total_invested, 2),
                "priced_invested_value": round(priced_invested, 2),
                "current_value": round(total_current_value, 2),
                "profit_loss": round(total_profit_loss, 2),
                "return_percentage": (
                    round(overall_return, 2) if overall_return is not None else None
                ),
            },
            "holdings": holdings,
        }
    )


@app.route("/analyze")
@login_required
def analyze():
    return render_template("analyze.html")



@app.route("/api/market-watch", methods=["GET"])
@login_required
def market_watch():
    import yfinance as yf

    watchlist = [
        # Market indices
        {"symbol": "^NSEI", "name": "Nifty 50", "category": "Indices"},
        {"symbol": "^BSESN", "name": "Sensex", "category": "Indices"},
        {"symbol": "^NSEBANK", "name": "Nifty Bank", "category": "Indices"},
        {"symbol": "^CNXIT", "name": "Nifty IT", "category": "Indices"},
        {"symbol": "^CNXAUTO", "name": "Nifty Auto", "category": "Indices"},

        # Banking
        {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "category": "Banking"},
        {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "category": "Banking"},
        {"symbol": "SBIN.NS", "name": "SBI", "category": "Banking"},
        {"symbol": "AXISBANK.NS", "name": "Axis Bank", "category": "Banking"},
        {"symbol": "KOTAKBANK.NS", "name": "Kotak Bank", "category": "Banking"},

        # IT
        {"symbol": "TCS.NS", "name": "TCS", "category": "IT"},
        {"symbol": "INFY.NS", "name": "Infosys", "category": "IT"},
        {"symbol": "WIPRO.NS", "name": "Wipro", "category": "IT"},
        {"symbol": "HCLTECH.NS", "name": "HCL Tech", "category": "IT"},

        # Popular large-cap stocks
        {"symbol": "RELIANCE.NS", "name": "Reliance", "category": "Popular"},
        {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "category": "Popular"},
        {"symbol": "ITC.NS", "name": "ITC", "category": "Popular"},
        {"symbol": "LT.NS", "name": "L&T", "category": "Popular"},

        # Automobile
        {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "category": "Auto"},
        {"symbol": "MARUTI.NS", "name": "Maruti Suzuki", "category": "Auto"},
        {"symbol": "M&M.NS", "name": "Mahindra & Mahindra", "category": "Auto"},
        {"symbol": "HEROMOTOCO.NS", "name": "Hero MotoCorp", "category": "Auto"},

        # Pharma
        {"symbol": "SUNPHARMA.NS", "name": "Sun Pharma", "category": "Pharma"},
        {"symbol": "DRREDDY.NS", "name": "Dr Reddy's", "category": "Pharma"},
        {"symbol": "CIPLA.NS", "name": "Cipla", "category": "Pharma"},
        {"symbol": "DIVISLAB.NS", "name": "Divi's Labs", "category": "Pharma"},

        # FMCG
        {"symbol": "HINDUNILVR.NS", "name": "HUL", "category": "FMCG"},
        {"symbol": "NESTLEIND.NS", "name": "Nestle India", "category": "FMCG"},
        {"symbol": "ITC.NS", "name": "ITC", "category": "FMCG"},
        {"symbol": "TATACONSUM.NS", "name": "Tata Consumer", "category": "FMCG"},
    ]

    results = []

    for item in watchlist:
        try:
            history = yf.Ticker(item["symbol"]).history(
                period="5d",
                interval="1d"
            )

            if history.empty or len(history) < 1:
                continue

            latest_price = float(history["Close"].iloc[-1])

            # Skip invalid prices
            if latest_price <= 0:
                continue

            previous_price = (
                float(history["Close"].iloc[-2])
                if len(history) >= 2
                else latest_price
            )

            change_pct = (
                ((latest_price - previous_price) / previous_price) * 100
                if previous_price > 0
                else 0
            )

            results.append({
                "symbol": item["symbol"].replace(".NS", "").replace(".BO", ""),
                "name": item["name"],
                "category": item["category"],
                "price": round(latest_price, 2),
                "change": round(latest_price - previous_price, 2),
                "change_pct": round(change_pct, 2),
            })

        except Exception:
            app.logger.warning(
                "Market ticker could not load %s",
                item["symbol"],
                exc_info=True,
            )
            continue

    return jsonify(results)
    
@app.route("/api/performance")
@login_required
def portfolio_performance():
    period = request.args.get("period", "1M").upper()

    period_days = {
        "1M": 30,
        "3M": 90,
        "6M": 180,
        "1Y": 365,
    }

    if period not in period_days:
        return jsonify({"error": "Invalid period"}), 400

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM stocks WHERE user_id = ?",
            (current_user.id,),
        ).fetchall()

    if not rows:
        return jsonify({
            "labels": [],
            "values": [],
            "change": 0,
            "change_pct": 0,
            "message": "Add holdings to see portfolio performance.",
        })

    from datetime import datetime, timedelta
    import pandas as pd

    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_days[period])

    # Combine historical prices for the stocks currently held.
    portfolio = None
    total_cost = 0.0
    unavailable = []

    for row in rows:
        stock = dict(row)

        # Change "symbol" below if your database uses a different column name.
        symbol = stock.get("symbol") or stock.get("ticker")

        if symbol and "." not in symbol and not symbol.startswith("^"):
            suffix = ".BO" if stock.get("exchange") == "BSE" else ".NS"
            symbol = f"{symbol}{suffix}"
        print("Performance chart symbol:", symbol)
        quantity = float(stock.get("quantity") or 0)
        buy_price = float(stock.get("buy_price") or 0)

        if not symbol or quantity <= 0:
            continue

        total_cost += quantity * buy_price

        try:
            history = yf.Ticker(symbol).history(
                start=start_date.strftime("%Y-%m-%d"),
                end=(end_date + timedelta(days=1)).strftime("%Y-%m-%d"),
                interval="1d",
                auto_adjust=True,
            )

            if history.empty:
                unavailable.append(symbol)
                continue

            prices = history["Close"].copy()
            prices.index = pd.to_datetime(prices.index).tz_localize(None).normalize()
            prices = prices[~prices.index.duplicated(keep="last")]

            weighted_prices = prices * quantity

            if portfolio is None:
                portfolio = weighted_prices.rename(symbol)
            else:
                portfolio = portfolio.to_frame().join(
                    weighted_prices.rename(symbol),
                    how="outer",
                ).sum(axis=1, min_count=1)

        except Exception:
            app.logger.exception(
                "Historical prices unavailable for %s", symbol
            )
            unavailable.append(symbol)

    if portfolio is None or portfolio.dropna().empty:
        return jsonify({
            "labels": [],
            "values": [],
            "change": 0,
            "change_pct": 0,
            "message": "Historical prices are currently unavailable.",
        })

    portfolio = portfolio.dropna().sort_index()

    # Return only the requested period.
    portfolio = portfolio[
        portfolio.index >= pd.Timestamp(start_date.date())
    ]

    values = [round(float(value), 2) for value in portfolio.tolist()]
    labels = [date.strftime("%d %b") for date in portfolio.index]

    change = values[-1] - values[0] if len(values) > 1 else 0
    change_pct = (
        (change / values[0]) * 100
        if len(values) > 1 and values[0] != 0
        else 0
    )

    return jsonify({
        "labels": labels,
        "values": values,
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "unavailable": unavailable,
        "message": (
            "Based on historical prices for your current holdings. "
            "Past transactions are not reconstructed."
        ),
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
