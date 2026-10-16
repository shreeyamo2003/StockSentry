
from calculations import (
    calculate_invested_value,
    calculate_current_value,
    calculate_profit_loss,
    calculate_return_percentage,
)

quantity = 20
buy_price = 200
current_price = 250

invested = calculate_invested_value(quantity, buy_price)
current_value = calculate_current_value(quantity, current_price)
profit_loss = calculate_profit_loss(quantity, buy_price, current_price)
return_pct = calculate_return_percentage(buy_price, current_price)

print(f"Invested Value: ₹{invested:,.2f}")
print(f"Current Value: ₹{current_value:,.2f}")
print(f"Profit/Loss: ₹{profit_loss:,.2f}")
print(f"Return: {return_pct:.2f}%")

assert invested == 4000
assert current_value == 5000
assert profit_loss == 1000
assert return_pct == 25

print("All calculation tests passed!")
