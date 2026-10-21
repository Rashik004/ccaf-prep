// Hourly job: pushes product updates and notifies suppliers.

import { findSupplier } from "./07_supplier-client";

interface Item {
  sku: string;
  updatedAt: string;
}

const outbox: string[] = [];

async function save(item: Item): Promise<void> {
  outbox.push(`${item.sku}@${item.updatedAt}`);
}

function notify(email: string, sku: string): void {
  outbox.push(`mail ${email}: ${sku} updated`);
}

export async function syncSupplier(sku: string): Promise<void> {
  try {
    const supplier = await findSupplier(sku);
    notify(supplier.email, sku);
  } catch {
    outbox.push(`no supplier for ${sku}`);
  }
}

export async function syncAll(items: Item[]): Promise<void> {
  items.forEach(async (i) => { await save(i); });
}
