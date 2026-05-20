const displayNamesCache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
    const cached = displayNamesCache.get(locale);
    if (cached) return cached;

    try {
        const displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
        displayNamesCache.set(locale, displayNames);
        return displayNames;
    } catch {
        return null;
    }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    ILS: '₪',
    JPY: '¥',
    CHF: 'Fr',
    CAD: 'C$',
    AUD: 'A$',
};

export function getCurrencySymbol(code: string): string {
    return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatCurrencyAmount(value: number, currency: string): string {
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const symbol = getCurrencySymbol(currency);
    if (symbol === '₪') return `${symbol}${formatted}`;
    if (symbol.length === 1 || symbol.endsWith('$')) return `${symbol}${formatted}`;
    return `${formatted} ${symbol}`;
}

export function resolveCurrencyLocale(language: string): string {
    if (language.startsWith('he')) return 'he';
    return 'en';
}

export function getLocalizedCurrencyName(code: string, language: string): string | undefined {
    const locale = resolveCurrencyLocale(language);
    const displayNames = getDisplayNames(locale);
    if (!displayNames) return undefined;

    try {
        const name = displayNames.of(code);
        return name && name !== code ? name : undefined;
    } catch {
        return undefined;
    }
}

export function getCurrencyDisplayName(
    code: string,
    englishName: string,
    language: string,
): string {
    return getLocalizedCurrencyName(code, language) ?? englishName;
}

export function matchesCurrencySearch(
    query: string,
    code: string,
    englishName: string,
    language: string,
): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    if (code.toLowerCase().includes(normalizedQuery)) return true;
    if (englishName.toLowerCase().includes(normalizedQuery)) return true;

    const localizedName = getLocalizedCurrencyName(code, language);
    if (localizedName?.toLowerCase().includes(normalizedQuery)) return true;

    return false;
}
