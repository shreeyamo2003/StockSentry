# StockSentry

A personal stock portfolio tracking and price alert system for Indian NSE and BSE stocks. StockSentry runs locally on your computer, stores your holdings in a SQLite database, and notifies you when a stock reaches a target price or range that you have set. It does not connect to brokerage accounts and never places trades, so every buy and sell decision stays with you.

## Features

StockSentry lets you add, edit and remove stock holdings with a quantity, purchase price and target price range. It retrieves market prices through yfinance and calculates your invested amount, current value, unrealised profit or loss, and percentage return. A background scheduler checks prices at regular intervals and creates a dashboard alert when a stock enters its target range through desktop notifications. If a fresh price cannot be retrieved, the last known price is kept and clearly marked as stale.

## Tech Stack

The frontend uses HTML, CSS and JavaScript. The backend is written in Python with Flask. SQLite stores holdings and alert history, APScheduler runs the periodic price checks, yfinance supplies market data, and python-dotenv loads email settings from a local `.env` file.

## Getting Started

You will need Python 3.10 or newer and Git.

```bash
git clone https://github.com/shreeyamo2003/StockSentry.git
cd StockSentry
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000 in your browser. The database is created automatically on first run.

## Email Alerts (Optional-you can approach if you like)

Create a `.env` file in the project root with your SMTP settings:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
ALERT_RECIPIENT=your-email@example.com
```

The `.env` file is excluded from version control and should never be committed.

## Project Structure

```
StockSentry/
├── app.py
├── database.py
├── prices.py
├── calculations.py
├── monitor.py
├── notifier.py
├── requirements.txt
├── templates/
└── static/
```
## Notification check(using this instead of email alerts)
Your notification only appears when a stock has one of these statuses:
- Approaching target
- Target reached
- Above target

If the stock is OUTSIDE_TARGET, no notification is sent.
Let's test it without changing your actual stock targets
Open Chrome → press F12 → Console, then paste:
```bash
new Notification("StockSentry Test", {
  body: "Your desktop notifications are working!",
  requireInteraction: true
});
```

## Limitations

Price data comes from an unofficial source and may be delayed or incomplete. Alerts only run while the application is open and your computer is awake, and they cannot guarantee notification at the exact moment a price crosses a target. StockSentry is a personal monitoring and educational tool, not financial advice.

By Shreeya
