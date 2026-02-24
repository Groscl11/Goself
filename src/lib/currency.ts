const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  NZD: 'NZ$',
  SGD: 'S$',
  HKD: 'HK$',
  KRW: '₩',
  BRL: 'R$',
  MXN: 'MX$',
  RUB: '₽',
  ZAR: 'R',
  AED: 'د.إ',
  SAR: 'ر.س',
};

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const symbol = currencySymbols[currencyCode.toUpperCase()] || currencyCode;

  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (['JPY', 'KRW'].includes(currencyCode.toUpperCase())) {
    return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
  }

  return `${symbol}${formattedAmount}`;
}

export function getCurrencySymbol(currencyCode: string): string {
  return currencySymbols[currencyCode.toUpperCase()] || currencyCode;
}
