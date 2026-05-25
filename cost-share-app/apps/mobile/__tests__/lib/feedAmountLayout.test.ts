import {
    scaleAmountValueFontSize,
    FEED_AMOUNT_COLUMN_MIN_WIDTH,
} from '../../lib/feedAmountLayout';

describe('feedAmountLayout', () => {
    it('keeps short amounts at the base font size', () => {
        expect(scaleAmountValueFontSize('84.20', 15)).toBe(15);
        expect(scaleAmountValueFontSize('1.00', 11)).toBe(11);
    });

    it('shrinks long amounts instead of wrapping', () => {
        expect(scaleAmountValueFontSize('1000000.00', 15)).toBe(14);
        expect(scaleAmountValueFontSize('1666666.66', 11)).toBe(10);
    });

    it('reserves a wider amount column than before', () => {
        expect(FEED_AMOUNT_COLUMN_MIN_WIDTH).toBeGreaterThanOrEqual(120);
    });
});
