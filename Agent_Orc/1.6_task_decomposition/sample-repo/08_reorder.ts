// Builds the nightly reorder list from current stock and thresholds.

export interface Threshold {
  sku: string;
  minimum: number;
  reorderQty: number;
}

export interface ReorderLine {
  sku: string;
  quantity: number;
}

export function reorderList(thresholds: Threshold[], stock: number[]): ReorderLine[] {
  const lines: ReorderLine[] = [];
  for (let i = 0; i <= thresholds.length; i++) {
    const t = thresholds[i];
    if (stock[i] < t.minimum) lines.push({ sku: t.sku, quantity: t.reorderQty });
  }
  return lines;
}

export function totalQuantity(lines: ReorderLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
