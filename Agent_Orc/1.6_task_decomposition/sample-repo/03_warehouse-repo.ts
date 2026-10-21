// Stock levels per warehouse, keyed by warehouse and SKU.

const levels = new Map<string, number>();

function key(warehouseId: string, sku: string): string {
  return `${warehouseId}:${sku}`;
}

export async function setStock(sku: string, warehouseId: string, units: number): Promise<void> {
  if (units < 0) throw new Error(`negative stock for ${sku}`);
  levels.set(key(warehouseId, sku), units);
}

export async function getStock(sku: string, warehouseId: string): Promise<number> {
  return levels.get(key(warehouseId, sku)) ?? 0;
}

export async function warehousesHolding(sku: string): Promise<string[]> {
  const ids: string[] = [];
  for (const [k, units] of levels) {
    const [warehouseId, itemSku] = k.split(":");
    if (itemSku === sku && units > 0) ids.push(warehouseId);
  }
  return ids;
}
