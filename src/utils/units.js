export const METERS_TO_FEET = 3.28084;

/**
 * Converts a value from metric (meters) to the target display unit.
 * @param {number} meters - The value in meters.
 * @param {string} units - The target unit ('metric' or 'imperial').
 * @returns {number} The converted value (rounded to 2 decimals for imperial).
 */
export const toDisplay = (meters, units) => {
    if (units === 'metric') return meters;
    return Number((meters * METERS_TO_FEET).toFixed(2));
};

/**
 * Converts a display value from the current unit back to metric (meters).
 * @param {number} displayValue - The value in the current unit.
 * @param {string} units - The current unit ('metric' or 'imperial').
 * @returns {number} The value in meters.
 */
export const toMetric = (displayValue, units) => {
    if (units === 'metric') return displayValue;
    return displayValue / METERS_TO_FEET;
};
