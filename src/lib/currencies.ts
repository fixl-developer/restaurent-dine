// Supported currencies with symbols and formatting
export const SUPPORTED_CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'en-EU' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  PHP: { symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export function getCurrencySymbol(code: string): string {
  const currency = SUPPORTED_CURRENCIES[code as CurrencyCode];
  return currency?.symbol || code;
}

export function getCurrencyName(code: string): string {
  const currency = SUPPORTED_CURRENCIES[code as CurrencyCode];
  return currency?.name || code;
}

export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  const currency = SUPPORTED_CURRENCIES[currencyCode as CurrencyCode];
  if (!currency) {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }

  return `${currency.symbol}${amount.toFixed(2)}`;
}
