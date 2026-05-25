/** Minimum width for the amount column on feed-style cards. */
export const FEED_AMOUNT_COLUMN_MIN_WIDTH = 124;

/** Fixed slot so AFN / ILS / USD codes share one start edge. */
export const FEED_AMOUNT_CURRENCY_WIDTH = 38;

/**
 * Shrink long numeric strings so amounts stay on one line inside the feed amount column.
 * Works on Android and iOS (adjustsFontSizeToFit is iOS-only).
 */
export function scaleAmountValueFontSize(
    value: string,
    baseFontSize: number,
): number {
    const len = value.length;
    if (len <= 8) return baseFontSize;
    if (len <= 10) return Math.max(baseFontSize - 1, 10);
    if (len <= 12) return Math.max(baseFontSize - 2, 10);
    if (len <= 14) return Math.max(baseFontSize - 3, 9);
    return Math.max(baseFontSize - 4, 9);
}
