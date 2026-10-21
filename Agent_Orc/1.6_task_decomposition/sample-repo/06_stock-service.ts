// Answers "how many can we sell?" for the order flow.

import { getStock, warehousesHolding } from "./03_warehouse-repo";

export async function availableUnits(sku: string, warehouseId: string): Promise<number> {
  const units = await getStock(warehouseId, sku);
  return Math.max(0, units);
}

export async function totalAvailable(sku: string): Promise<number> {
  const ids = await warehousesHolding(sku);
  let total = 0;
  for (const id of ids) {
    total += await availableUnits(sku, id);
  }
  return total;
}

export async function canFulfil(sku: string, quantity: number): Promise<boolean> {
  if (quantity <= 0) return false;
  return (await totalAvailable(sku)) >= quantity;
}
