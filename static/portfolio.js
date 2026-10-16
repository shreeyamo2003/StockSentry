
const money = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(value);

const percentage = (value) =>
  value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const number = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(value ?? 0);

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function targetState(stock) {
  const price = stock.last_price;
  const low = Number(stock.target_min);
  const high = Number(stock.target_max);
  const nearPct = Number(stock.near_pct ?? 5);

  if (price == null) {
    return { label: "Price unavailable", className: "status-stale", progress: 0 };
  }

  if (stock.price_is_stale) {
    return { label: "Last known price · refresh recommended", className: "status-stale", progress: 0 };
  }

  if (price >= low && price <= high) {
    return { label: "Price is inside your target range", className: "status-inside", progress: 100 };
  }

  if (price > high) {
    return { label: "Price is above your target range", className: "", progress: 100 };
  }

  const distancePct = ((low - price) / low) * 100;

  if (distancePct <= nearPct) {
    return {
      label: `Approaching target · ${distancePct.toFixed(2)}% below its lower limit`,
      className: "",
      progress: Math.max(0, Math.min(100, (price / low) * 100))
    };
  }

  return {
    label: `${distancePct.toFixed(2)}% below lower target`,
    className: "",
    progress: Math.max(0, Math.min(100, (price / low) * 100))
  };
}

function renderHolding(stock, index) {
  const state = targetState(stock);
  const pl = stock.profit_loss;
  const returnValue = stock.return_percentage;
  const updated = stock.last_price_updated
    ? new Date(stock.last_price_updated).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Not updated yet";

  const initial = (stock.symbol || "?").slice(0, 2);

  return `
    <article class="holding-card" style="animation-delay:${Math.min(index * 70, 350)}ms">
      <div class="holding-top">
        <div class="holding-identity">
          <div class="holding-monogram">${safeText(initial)}</div>
          <div>
            <h4 class="holding-name">${safeText(stock.company_name)}</h4>
            <span class="holding-symbol">${safeText(stock.symbol)}</span>
          </div>
        </div>
        <span class="exchange-tag">${safeText(stock.exchange)}</span>
      </div>

      <div class="holding-price-row">
        <div>
          <span class="holding-current-label">Latest available price</span>
          <strong class="holding-current-price">${money(stock.last_price)}</strong>
        </div>
        <div class="holding-return ${pl != null && pl < 0 ? "negative" : ""}">
          <div>${pl == null ? "P/L unavailable" : `${pl >= 0 ? "+" : ""}${money(pl)}`}</div>
          <div>${percentage(returnValue)}</div>
        </div>
      </div>

      <div class="holding-metrics">
        <div class="holding-metric">
          <span>Quantity</span>
          <strong>${number(stock.quantity)} shares</strong>
        </div>
        <div class="holding-metric">
          <span>Buy price</span>
          <strong>${money(stock.buy_price)}</strong>
        </div>
        <div class="holding-metric">
          <span>Current value</span>
          <strong>${money(stock.current_value)}</strong>
        </div>
      </div>

      <div class="target-box">
        <div class="target-header">
          <span class="target-title">YOUR TARGET ZONE</span>
          <span class="target-range">${money(stock.target_min)} – ${money(stock.target_max)}</span>
        </div>
        <div class="target-track" role="progressbar"
             aria-label="Price relative to lower target"
             aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${Math.round(state.progress)}">
          <div class="target-fill" style="width:${state.progress}%"></div>
        </div>
        <div class="target-status ${state.className}">
          ${safeText(state.label)}
        </div>
      </div>

      <div class="holding-footer">
        <span class="price-updated">
          ${stock.price_is_stale ? "Possibly stale" : "Price fetched"} · ${safeText(updated)}
        </span>
        <button class="delete-holding" data-delete-id="${stock.id}">
          Remove
        </button>
      </div>
    </article>
  `;
}

function renderEmpty() {
  return `
    <div class="portfolio-empty">
      <div class="portfolio-empty-mark">↗</div>
      <h3>Your portfolio starts here.</h3>
      <p>Add your first holding to see its latest available price,
         performance and target progress in one place.</p>
      <button class="btn btn-primary" data-open-modal>Track your first stock</button>
    </div>
  `;
}

async function loadPortfolio() {
  const refreshButton = document.getElementById("refresh-portfolio");
  const message = document.getElementById("portfolio-message");
  const grid = document.getElementById("holdings-grid");

  if (!grid || !message) return;

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing…";
  }

  message.textContent = "Fetching your portfolio data…";

  try {
    const response = await fetch("/api/portfolio");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load portfolio.");
    }

    const summary = data.summary;
    const holdings = data.holdings || [];

    document.getElementById("portfolio-current").textContent =
      money(summary.current_value);

    document.getElementById("portfolio-invested").textContent =
      money(summary.total_invested_value);

    document.getElementById("portfolio-pl").textContent =
      `${summary.profit_loss >= 0 ? "+" : ""}${money(summary.profit_loss)}`;

    document.getElementById("portfolio-return").textContent =
      summary.return_percentage == null
        ? "Return unavailable until prices are fetched"
        : `${percentage(summary.return_percentage)} overall return on priced holdings`;

    document.getElementById("portfolio-count").textContent =
      number(summary.total_holdings);

    document.getElementById("portfolio-priced").textContent =
      `${summary.priced_holdings} of ${summary.total_holdings} holdings priced`;

    document.getElementById("holdings-count").textContent =
      `${summary.total_holdings} HOLDING${summary.total_holdings === 1 ? "" : "S"}`;

    grid.innerHTML = holdings.length
      ? holdings.map(renderHolding).join("")
      : renderEmpty();

    message.textContent = holdings.length
      ? "Your saved holdings, updated from the portfolio API."
      : "No holdings added yet.";

  } catch (error) {
    message.textContent = `Couldn't load portfolio: ${error.message}`;
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ Refresh prices";
    }
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  const id = button.dataset.deleteId;

  if (!window.confirm("Remove this holding from StockSentry?")) return;

  button.disabled = true;

  try {
    const response = await fetch(`/api/holdings/${id}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not remove holding.");
    }

    await loadPortfolio();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
});

document.getElementById("refresh-portfolio")?.addEventListener(
  "click",
  loadPortfolio
);

document.addEventListener("DOMContentLoaded", loadPortfolio);


document.getElementById("add-holding")?.addEventListener("click", () => {
  window.location.href = "/#add-holding";
});

