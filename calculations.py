
def calculate_invested_value(quantity, buy_price):
    """Total amount invested in the stock."""
    return quantity * buy_price


def calculate_current_value(quantity, current_price):
    """Current market value of the holding."""
    return quantity * current_price


def calculate_profit_loss(quantity, buy_price, current_price):
    """Unrealized profit or loss."""
    invested = calculate_invested_value(quantity, buy_price)
    current_value = calculate_current_value(quantity, current_price)
    return current_value - invested


def calculate_return_percentage(buy_price, current_price):
    """Percentage return on the purchase price."""
    if buy_price <= 0:
        raise ValueError("Buy price must be greater than zero.")

    return ((current_price - buy_price) / buy_price) * 100
