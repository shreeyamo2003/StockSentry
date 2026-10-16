
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "stocksentry.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                buy_price REAL NOT NULL CHECK (buy_price > 0),
                buy_date TEXT,
                target_min REAL NOT NULL CHECK (target_min > 0),
                target_max REAL NOT NULL CHECK (target_max >= target_min),
                near_pct REAL NOT NULL DEFAULT 5
                    CHECK (near_pct >= 0 AND near_pct <= 100),
                email_alerts INTEGER NOT NULL DEFAULT 0
                    CHECK (email_alerts IN (0, 1)),
                alert_email TEXT,
                last_price REAL,
                last_price_updated TEXT,
                price_is_stale INTEGER NOT NULL DEFAULT 1
                    CHECK (price_is_stale IN (0, 1)),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stock_id INTEGER NOT NULL,
                alert_type TEXT NOT NULL,
                price REAL NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES stocks(id)
                    ON DELETE CASCADE
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_alerts_stock_id
            ON alerts(stock_id)
        """)


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at: {DB_PATH}")
