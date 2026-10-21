// Unit prices. Stored and returned as integer cents to avoid float rounding.

const PRICES: Record<string, number> = {
  "SKU-100": 1299,
  "SKU-200": 4550,
  "SKU-300": 899,
};

export function getUnitPrice(sku: string): number {
  const cents = PRICES[sku];
  if (cents === undefined) throw new Error(`no price for ${sku}`);
  return cents;
}

export function applyDiscount(cents: number, percent: number): number {
  if (percent < 0 || percent > 100) throw new Error(`bad discount ${percent}`);
  return Math.round(cents * (1 - percent / 100));
}
