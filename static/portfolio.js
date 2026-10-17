
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

let investmentChart = null;
let profitLossChart = null;

const chartColours = [
  "#641E32", // Burgundy
  "#2449A6", // Royal blue
  "#B76E79", // Dusty rose
  "#7795C8", // Muted blue
  "#B9A08A", // Warm beige
  "#92718A"  // Muted plum
];

const chartMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);

function renderPortfolioCharts(holdings) {
  const investmentCanvas = document.getElementById("investment-chart");
  const profitLossCanvas = document.getElementById("profit-loss-chart");

  if (!investmentCanvas || !profitLossCanvas ||
      typeof Chart === "undefined") {
    return;
  }

  // Destroy old charts before redrawing them.
  if (investmentChart) investmentChart.destroy();
  if (profitLossChart) profitLossChart.destroy();

  // Investment breakdown includes holdings with valid purchase details.
  const investedHoldings = holdings.filter((stock) =>
    Number.isFinite(Number(stock.quantity)) &&
    Number(stock.quantity) > 0 &&
    Number.isFinite(Number(stock.buy_price)) &&
    Number(stock.buy_price) > 0
  );

  const investmentLabels = investedHoldings.map(
    (stock) => stock.symbol
  );

  const investmentValues = investedHoldings.map(
    (stock) => Number(stock.quantity) * Number(stock.buy_price)
  );

  investmentChart = new Chart(investmentCanvas, {
    type: "doughnut",
    data: {
      labels: investmentLabels,
      datasets: [{
        data: investmentValues,
        backgroundColor: investmentLabels.map(
          (_, index) => chartColours[index % chartColours.length]
        ),
        borderColor: "#F6F0E6",
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#29252A",
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle"
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const total = context.dataset.data.reduce(
                (sum, value) => sum + value, 0
              );
              const value = context.raw;
              const share = total ? (value / total) * 100 : 0;

              return ` ${chartMoney(value)} (${share.toFixed(2)}%)`;
            }
          }
        }
      }
    }
  });

  // Only include holdings with an available P/L value.
  const pricedHoldings = holdings.filter((stock) =>
    stock.profit_loss != null &&
    Number.isFinite(Number(stock.profit_loss))
  );

  const plLabels = pricedHoldings.map(
    (stock) => stock.symbol
  );

  const plValues = pricedHoldings.map(
    (stock) => Number(stock.profit_loss)
  );

  profitLossChart = new Chart(profitLossCanvas, {
    type: "bar",
    data: {
      labels: plLabels,
      datasets: [{
        label: "Profit / Loss",
        data: plValues,
        backgroundColor: plValues.map((value) =>
          value >= 0 ? "#2449A6" : "#641E32"
        ),
        borderRadius: 6,
        barThickness: "flex",
        maxBarThickness: 34
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${chartMoney(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(100, 30, 50, 0.10)"
          },
          ticks: {
            color: "#51464B",
            callback(value) {
              return new Intl.NumberFormat("en-IN", {
                notation: "compact",
                maximumFractionDigits: 1
              }).format(value);
            }
          },
          title: {
            display: true,
            text: "Profit / loss (₹)",
            color: "#51464B"
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: "#29252A"
          }
        }
      }
    }
  });
}

function renderHolding(stock, index) {
  const state = targetState(stock);
  
const alertLabels = {
  APPROACHING_TARGET: "Approaching target",
  TARGET_REACHED: "Target reached",
  ABOVE_TARGET: "Above target",
  OUTSIDE_TARGET: "Outside target",
  PRICE_UNAVAILABLE: "Price unavailable"
};

const alertClassNames = {
  APPROACHING_TARGET: "approaching",
  TARGET_REACHED: "reached",
  ABOVE_TARGET: "above",
  OUTSIDE_TARGET: "outside",
  PRICE_UNAVAILABLE: "unavailable"
};

const alertStatus = stock.target_status || "PRICE_UNAVAILABLE";
const alertLabel = alertLabels[alertStatus] || "Status unavailable";
const alertClass = alertClassNames[alertStatus] || "unavailable";

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
      
        <div class="target-alert-badge ${alertClass}">
          ${safeText(alertLabel)}
        </div>

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
    checkTargetNotifications(holdings);
    renderPortfolioCharts(holdings);
    updateRiskAlerts(holdings); 
    
console.log("Checking StockSentry notifications:", holdings.map(s => ({
    symbol: s.symbol,
    status: s.target_status
})));

    

function updateRiskAlerts(holdings) {
    const concentrationElement = document.getElementById("risk-concentration");
    const lossCountElement = document.getElementById("risk-loss-count");
    const staleCountElement = document.getElementById("risk-stale-count");

    if (!concentrationElement || !lossCountElement || !staleCountElement) {
        return;
    }

    const validHoldings = holdings.filter(stock =>
        Number(stock.quantity) > 0 &&
        Number(stock.buy_price) > 0
    );

    const investedAmounts = validHoldings.map(stock =>
        Number(stock.quantity) * Number(stock.buy_price)
    );

    const totalInvested = investedAmounts.reduce(
        (total, amount) => total + amount, 0
    );

    const largestInvestment = investedAmounts.length
        ? Math.max(...investedAmounts)
        : 0;

    const concentration = totalInvested > 0
        ? (largestInvestment / totalInvested) * 100
        : 0;

    const lossCount = holdings.filter(stock =>
        stock.profit_loss != null &&
        Number.isFinite(Number(stock.profit_loss)) &&
        Number(stock.profit_loss) < 0
    ).length;

    const staleCount = holdings.filter(stock =>
        stock.price_is_stale === true ||
        Number(stock.price_is_stale) === 1
    ).length;

    concentrationElement.textContent = validHoldings.length
        ? `${concentration.toFixed(1)}%`
        : "No holdings";

    lossCountElement.textContent = `${lossCount} stock${lossCount === 1 ? "" : "s"}`;
    staleCountElement.textContent = `${staleCount} stock${staleCount === 1 ? "" : "s"}`;

    const concentrationCard = concentrationElement.closest(".risk-card");
    const lossCard = lossCountElement.closest(".risk-card");
    const staleCard = staleCountElement.closest(".risk-card");

    // Concentration warning when one stock exceeds 50% of invested capital
    if (concentrationCard) {
        concentrationCard.classList.remove("risk-warning", "risk-good", "risk-neutral");

        if (!validHoldings.length) {
            concentrationCard.classList.add("risk-neutral");
        } else if (concentration > 50) {
            concentrationCard.classList.add("risk-warning");
        } else {
            concentrationCard.classList.add("risk-good");
        }
    }

    // Warning if any holding has a negative profit/loss
    if (lossCard) {
        lossCard.classList.remove("risk-warning", "risk-good", "risk-neutral");
        lossCard.classList.add(lossCount > 0 ? "risk-warning" : "risk-good");
    }

    // Warning if any holding has stale price data
    if (staleCard) {
        staleCard.classList.remove("risk-warning", "risk-good", "risk-neutral");
        staleCard.classList.add(staleCount > 0 ? "risk-warning" : "risk-good");
    }
}


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


async function requestStockSentryNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("This browser does not support notifications.");
        return;
    }

    if (Notification.permission === "granted") {
        return;
    }

    if (Notification.permission === "default") {
    console.info("Notification permission has not been granted yet.");
    return;
}

    console.warn("Notifications are blocked in browser settings.");
}

function sendStockSentryNotification(stock, status) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    const messages = {
        APPROACHING_TARGET: "is approaching your target range.",
        TARGET_REACHED: "has entered your target range!",
        ABOVE_TARGET: "has moved above your target range."
    };

    const message = messages[status];
    if (!message) return;

    new Notification("StockSentry: " + stock.symbol, {
        body: `${stock.symbol} ${message} Current price: ₹${stock.last_price}.`,
        tag: `stocksentry-${stock.id}-${status}`
    });
}

requestStockSentryNotificationPermission();



function checkTargetNotifications(holdings) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
        console.log("Notifications unavailable:", Notification.permission);
        return;
    }

    holdings.forEach(stock => {
        const status = stock.target_status;

        if (!["APPROACHING_TARGET", "TARGET_REACHED", "ABOVE_TARGET"].includes(status)) {
            return;
        }

        const storageKey = `stocksentry-alert-${stock.id}`;
        const previousStatus = localStorage.getItem(storageKey);

        console.log("Stock alert check:", stock.symbol, {
            status,
            previousStatus
        });

        if (previousStatus === status) {
            return;
        }

        const messages = {
            APPROACHING_TARGET: "is approaching your target range.",
            TARGET_REACHED: "has entered your target range!",
            ABOVE_TARGET: "has moved above your target range."
        };

        const notification = new Notification(`StockSentry: ${stock.symbol}`, {
            body: `${messages[status]} Current price: ₹${stock.last_price}.`,
            tag: `stocksentry-${stock.id}-${status}`,
            requireInteraction: true
        });

        localStorage.setItem(storageKey, status);
    });
}

let marketStocks = [];
let selectedMarketCategory = "All";

async function loadMarketTicker() {
    const track = document.getElementById("marketTickerTrack");
    if (!track) return;

    try {
        const response = await fetch("/api/market-watch");

        if (!response.ok) {
            throw new Error("Unable to fetch market prices");
        }

        marketStocks = await response.json();
        renderMarketTicker();
        renderMarketCategories();
    } catch (error) {
        console.error("Market ticker error:", error);
        track.innerHTML = `
            <div class="market-ticker-loading">
                Could not load market prices. Please refresh.
            </div>`;
        document.getElementById("marketTickerCount").textContent =
            "Market data unavailable";
    }
}

function renderMarketCategories() {
    const container = document.getElementById("marketCategoryFilters");
    if (!container) return;

    const categories = [
        "All",
        ...new Set(marketStocks.map(stock => stock.category).filter(Boolean))
    ];

    container.innerHTML = categories.map(category => `
        <button
            type="button"
            class="market-category-btn ${
                category === selectedMarketCategory ? "active" : ""
            }"
            data-category="${category}">
            ${category === "All" ? "All stocks" : category}
        </button>
    `).join("");
}

function renderMarketTicker() {
    const track = document.getElementById("marketTickerTrack");
    const count = document.getElementById("marketTickerCount");
    const searchInput = document.getElementById("marketTickerSearch");

    if (!track) return;

    const query = (searchInput?.value || "").trim().toLowerCase();

    const filtered = marketStocks.filter(stock => {
        const matchesCategory =
            selectedMarketCategory === "All" ||
            stock.category === selectedMarketCategory;

        const matchesSearch =
            String(stock.symbol || "").toLowerCase().includes(query) ||
            String(stock.name || "").toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
    });

    if (count) {
        count.textContent = `${filtered.length} stocks shown`;
    }

    if (!filtered.length) {
        track.innerHTML = `
            <div class="market-ticker-loading">
                No matching stocks found.
            </div>`;
        return;
    }

    track.innerHTML = filtered.map(stock => {
        const change = Number(stock.change_pct || 0);
        const positive = change >= 0;
        const sign = positive ? "+" : "";

        return `
            <article class="market-ticker-card">
                <div class="market-ticker-symbol">
                    ${escapeTickerText(stock.symbol)}
                </div>
                <div class="market-ticker-name">
                    ${escapeTickerText(stock.name)}
                </div>
                <div class="market-ticker-price">
                    ₹${Number(stock.price).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </div>
                <div class="market-ticker-change ${
                    positive ? "positive" : "negative"
                }">
                    ${positive ? "▲" : "▼"}
                    ${sign}${change.toFixed(2)}%
                </div>
            </article>`;
    }).join("");

    // Start the filtered list at its beginning.
    document.getElementById("marketTicker")?.scrollTo({
        left: 0,
        behavior: "smooth"
    });
}

function escapeTickerText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


let marketSearchTimer;

document.addEventListener("input", event => {
    if (event.target.id !== "marketTickerSearch") return;

    const query = event.target.value.trim();
    const dropdown = document.getElementById("marketSearchDropdown");

    clearTimeout(marketSearchTimer);

    if (!dropdown) return;

    if (query.length < 2) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        renderMarketTicker();
        return;
    }

    dropdown.hidden = false;
    dropdown.innerHTML = `
        <div class="market-search-message">Searching NSE stocks...</div>
    `;

    marketSearchTimer = setTimeout(async () => {
        try {
            const response = await fetch(
                `/api/market-search?q=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error("Stock search failed");
            }

            const results = await response.json();

            // Ignore results if the user has already changed the query.
            if (document.getElementById("marketTickerSearch")?.value.trim() !== query) {
                return;
            }

            if (!results.length) {
                dropdown.innerHTML = `
                    <div class="market-search-message">
                        No matching NSE stocks found.
                    </div>
                `;
                return;
            }

            dropdown.innerHTML = results.map(stock => `
                <button
                    type="button"
                    class="market-search-option"
                    data-symbol="${escapeTickerText(stock.symbol)}"
                    data-name="${escapeTickerText(stock.name)}"
                    role="option"
                >
                    <span class="market-search-option-symbol">
                        ${escapeTickerText(stock.symbol)}
                    </span>
                    <span class="market-search-option-name">
                        ${escapeTickerText(stock.name)}
                    </span>
                </button>
            `).join("");

        } catch (error) {
            console.error("Stock search error:", error);
            dropdown.innerHTML = `
                <div class="market-search-message">
                    Search unavailable. Please try again.
                </div>
            `;
        }
    }, 300);
});


document.addEventListener("click", event => {
    const button = event.target.closest(".market-category-btn");
    if (!button) return;

    selectedMarketCategory = button.dataset.category || "All";

    document.querySelectorAll(".market-category-btn").forEach(item => {
        item.classList.toggle("active", item === button);
    });

    renderMarketTicker();
});

loadMarketTicker();


let performanceChart = null;

async function loadPerformanceChart(period = "1M") {
    const canvas = document.getElementById("performance-chart");
    const note = document.getElementById("performance-note");

    if (!canvas || typeof Chart === "undefined") return;

    if (note) {
        note.textContent = "Loading historical performance...";
    }

    try {
        const response = await fetch(
            `/api/performance?period=${encodeURIComponent(period)}`
        );

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();

        const valueElement = document.getElementById("performance-value");
        const profitElement = document.getElementById("performance-profit");

        if (!data.values || data.values.length === 0) {
            if (performanceChart) {
                performanceChart.destroy();
                performanceChart = null;
            }

            if (valueElement) valueElement.textContent = "₹—";
            if (profitElement) profitElement.textContent = "—";
            if (note) {
                note.textContent =
                    data.message || "No historical data available yet.";
            }
            return;
        }

        const latest = data.values[data.values.length - 1];
        const change = Number(data.change || 0);
        const changePct = Number(data.change_pct || 0);

        if (valueElement) {
            valueElement.textContent = latest.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2
            });
        }

        if (profitElement) {
            const sign = change > 0 ? "+" : "";
            profitElement.textContent =
                `${sign}${change.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 2
                })} (${sign}${changePct.toFixed(2)}%)`;

            profitElement.style.color =
                change >= 0 ? "#20805b" : "#bd3847";
        }

        const context = canvas.getContext("2d");

        if (performanceChart) {
            performanceChart.destroy();
        }

        performanceChart = new Chart(context, {
            type: "line",
            data: {
                labels: data.labels,
                datasets: [{
                    label: "Portfolio value",
                    data: data.values,
                    borderColor: "#641729",
                    backgroundColor: "rgba(100, 23, 41, 0.10)",
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: data.values.length > 40 ? 0 : 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.parsed.y.toLocaleString(
                                    "en-IN",
                                    {
                                        style: "currency",
                                        currency: "INR",
                                        maximumFractionDigits: 2
                                    }
                                );
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 7
                        }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function (value) {
                                return "₹" +
                                    Number(value).toLocaleString("en-IN");
                            }
                        }
                    }
                }
            }
        });

        if (note) {
            note.textContent = data.message || "Historical portfolio values";
            if (data.unavailable && data.unavailable.length) {
                note.textContent +=
                    ` Missing data for: ${data.unavailable.join(", ")}.`;
            }
        }

    } catch (error) {
        console.error("Performance chart error:", error);

        if (note) {
            note.textContent =
                "Could not load performance data. Check the server logs.";
        }
    }
}

document.querySelectorAll(".period-btn").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".period-btn").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");
        loadPerformanceChart(button.dataset.period);
    });
});

loadPerformanceChart("1M");


const addedMarketSymbols = new Set();

document.addEventListener("click", async event => {
    const option = event.target.closest(".market-search-option");
    const dropdown = document.getElementById("marketSearchDropdown");
    const searchInput = document.getElementById("marketTickerSearch");

    // Close the dropdown when clicking outside the search area.
    if (!option) {
        if (
            dropdown &&
            !event.target.closest(".market-ticker-search-wrapper")
        ) {
            dropdown.hidden = true;
        }
        return;
    }

    const symbol = option.dataset.symbol;
    const name = option.dataset.name;

    if (!symbol) return;

    if (addedMarketSymbols.has(symbol)) {
        dropdown.hidden = true;
        if (searchInput) searchInput.value = "";
        renderMarketTicker();
        return;
    }

    option.disabled = true;
    option.querySelector(".market-search-option-name").textContent =
        "Fetching price...";

    try {
        const response = await fetch(
            `/api/market-price/${encodeURIComponent(symbol)}`
        );
        const stock = await response.json();

        if (!response.ok) {
            throw new Error(stock.error || "Price unavailable");
        }

        stock.name = stock.name || name;
        stock.category = stock.category || "NSE Stocks";

        marketStocks.push(stock);
        addedMarketSymbols.add(symbol);

        selectedMarketCategory = "All";
        renderMarketCategories();

        if (searchInput) searchInput.value = "";
        if (dropdown) {
            dropdown.hidden = true;
            dropdown.innerHTML = "";
        }

        renderMarketTicker();

    } catch (error) {
        console.error("Could not add stock:", error);
        option.disabled = false;
        option.querySelector(".market-search-option-name").textContent =
            "Price unavailable. Try again.";
    }
});
