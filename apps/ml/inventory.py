"""Cálculos explícitos para sugerencias de inventario de demostración."""

import math


def forecast_indicators(forecast, stock, lead_days, coverage_days, price):
    """Use the daily forecast over each period, including its weekly pattern."""
    total = sum(forecast)
    lead_demand = sum(forecast[:lead_days])
    reserve_demand = sum(forecast[:lead_days + coverage_days])
    coverage = None
    if stock is not None and total > 0:
        remaining = stock
        if remaining == 0:
            coverage = 0
        else:
            for day, demand in enumerate(forecast):
                if demand > 0 and remaining <= demand:
                    coverage = day + remaining / demand
                    break
                remaining -= demand
    return {
        'forecast_units': total,
        'coverage_days': coverage,
        'coverage_exceeds_horizon': stock is not None and total > 0 and stock > total,
        'stockout_risk': None if stock is None else lead_demand > 0 and stock <= lead_demand,
        'suggested_reorder': None if stock is None else max(0, math.ceil(reserve_demand - stock)),
        'estimated_revenue': None if price is None else total * price,
    }
