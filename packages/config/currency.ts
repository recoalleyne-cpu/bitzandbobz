export type CurrencyConfig = {
  code: string;
  locale: string;
};

export const currency: CurrencyConfig = {
  code: "BBD",
  locale: "en-BB"
};

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code
  }).format(cents / 100);
}

