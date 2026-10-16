# StockSentry: Developer Quick Reference

A reusable cheat sheet for running the local Flask app, testing APIs, checking calculations, and using Git in VS Code on Windows.

## 1. Current project status

- [x] **Step 1: Hello Flask** — `app.py` serves `index.html` at `http://127.0.0.1:5000`.
- [x] **Step 2: Database** — SQLite `stocksentry.db` contains `stocks` and `alerts` tables.
- [x] **Step 3: Holdings API** — GET and POST have been tested; the website form saves stocks to SQLite. PUT and DELETE should also be tested.
- [x] **Step 4: Calculations** — formulas passed the sample test: 20 shares bought at ₹200 and current price ₹250 gives ₹1,000 profit and 25% return.
- [ ] **Step 5: Price fetching** — use `yfinance`; save price timestamps and mark failed fetches as stale.
- [ ] **Step 6: Dashboard** — holdings table, summary cards, charts, and refresh using `fetch()`.
- [ ] **Step 7: Monitoring** — scheduled checks and alerts only when a price newly enters the target range.
- [ ] **Step 8: Email alerts** — SMTP with credentials loaded from `.env`.
- [ ] **Step 9: Testing** — test prices below, inside, and above the target range, plus failed price fetches.

## 2. Open the project and start Flask

1. In VS Code, select **File → Open Folder** and open the main `StockSentry` folder.
2. Select **Terminal → New Terminal**.
3. Check that the terminal is in the project folder, for example `D:\CBA\stocksentry`.

### Activate the virtual environment

Run this in PowerShell if the terminal prompt does not already show `(venv)`:

```powershell
.\venv\Scripts\Activate.ps1
```

If `(venv)` is already visible, the environment is active.

### Check Python and start the app

```powershell
python --version
python app.py
```

Open this URL in your browser:

```text
http://127.0.0.1:5000
```

Keep the terminal running while using the site. Stop Flask with **Ctrl + C** in that terminal.

If Flask is missing:

```powershell
python -m pip install flask
```

If the project has a `requirements.txt` file:

```powershell
python -m pip install -r requirements.txt
```

## 3. API quick tests

Keep Flask running in **Terminal 1**. Run API commands in **Terminal 2**. These commands are for PowerShell, not the Python `>>>` prompt.

### List holdings (GET)

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/holdings" -Method Get
```

An empty response is normal if no stocks have been added.

### Add a test holding (POST)

```powershell
$body = @{
    company_name = "Reliance Industries"
    symbol = "RELIANCE"
    exchange = "NSE"
    quantity = 20
    buy_price = 200
    target_min = 240
    target_max = 250
    near_pct = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/holdings" -Method Post -ContentType "application/json" -Body $body
```

**Note:** Every POST creates a new row. Running this repeatedly creates duplicate test holdings.

### Update a holding (PUT)

Change `1` in the URL to the actual stock ID. Send all required fields.

```powershell
$body = @{
    company_name = "Reliance Industries"
    symbol = "RELIANCE"
    exchange = "NSE"
    quantity = 20
    buy_price = 200
    target_min = 240
    target_max = 255
    near_pct = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/holdings/1" -Method Put -ContentType "application/json" -Body $body
```

### Delete a holding (DELETE)

**Caution:** This permanently deletes the selected holding and its related alerts. Confirm the ID first.

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/holdings/1" -Method Delete
```

### Database check

The API GET command is usually the easiest way to check saved holdings. If you need to inspect the SQLite table directly, open Python:

```powershell
python
```

Then enter these lines at the `>>>` prompt:

```python
import sqlite3
c = sqlite3.connect("stocksentry.db")
print(c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())
print(c.execute("SELECT id, company_name, symbol FROM stocks").fetchall())
c.close()
exit()
```

Expected table names include `stocks` and `alerts` (plus SQLite's internal `sqlite_sequence` table).

## 4. Run calculation tests

If you keep `test_calculations.py`, run:

```powershell
python test_calculations.py
```

Expected example for 20 shares bought at ₹200, with current price ₹250:

- Invested value: ₹4,000
- Current value: ₹5,000
- Unrealized profit: ₹1,000
- Return: 25%

You can delete `test_calculations.py` after a successful test, but keeping it is useful for checking calculations again after code changes. It does not need to run while Flask is running.

## 5. Git commands

Run Git commands from the project folder.

### Check what changed

```powershell
git status
git diff
```

### Stage one file

```powershell
git add app.py
```

### Stage selected files

```powershell
git add app.py database.py calculations.py static/script.js
```

### Stage all changes

```powershell
git status
git add .
git status
```

Review the staged file list before committing. Do not stage secrets or your local database.

### Review staged changes

```powershell
git diff --staged
```

### Commit changes

```powershell
git commit -m "Connect holdings form to API"
```

Use a short message that describes the actual changes you made.

### View recent commits

```powershell
git log --oneline -5
```

### Unstage a file (keeps your edits)

```powershell
git restore --staged filename
```

### First-time Git identity setup

Only if Git asks you to configure your identity, use your own details:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

If you have a remote repository configured, inspect it with:

```powershell
git remote -v
```

Only push when you intend to upload your commits.

## 6. Protect credentials and local data

Make sure `.gitignore` includes entries like these:

```gitignore
venv/
.env
*.db
__pycache__/
*.pyc
```

- Never commit `.env` files, email app passwords, or other credentials.
- Keep the local SQLite database out of Git unless you have a deliberate, safe reason to share a test database.
- Before `git add .`, run `git status` and inspect the files.

## 7. Common issues

| Problem | What to check |
|---|---|
| `No module named flask` | Activate `(venv)` and run `python -m pip install flask`. |
| `TemplateNotFound: index.html` | Confirm `index.html` is inside `templates/`. |
| CSS or JavaScript does not load | Confirm `style.css` and `script.js` are inside `static/`. |
| Port 5000 is already in use | Stop the other process or intentionally configure another port. |
| GET returns no holdings | Confirm POST succeeded and Flask is using the expected project folder/database. |
| POST adds duplicates | The current API allows duplicate holdings; each POST creates a new row. |
| Current price is blank/stale | Price fetching has not been implemented yet; this is expected at this stage. |
| PowerShell quoting errors | Run commands directly in PowerShell or use the Python interactive prompt for SQL checks. |

## 8. Development checklist

- [x] Flask homepage loads.
- [x] SQLite `stocks` and `alerts` tables are created.
- [x] Website form saves a holding to SQLite.
- [ ] Test PUT and DELETE API routes.
- [x] Calculation functions pass the example test.
- [ ] Fetch NSE/BSE prices and save the price timestamp.
- [ ] Mark prices stale when fetching fails.
- [ ] Build the dashboard table, summary cards, and charts.
- [ ] Schedule price checks.
- [ ] Create an alert only when the price newly enters the target range.
- [ ] Add SMTP email notifications using `.env`.
- [ ] Test prices below, inside, and above the target range.

## 9. Next step

Create `prices.py` and test one ticker such as `RELIANCE.NS` independently using `yfinance` before integrating price fetching into Flask or the database.
