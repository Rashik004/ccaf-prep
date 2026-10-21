// Supplier directory, fetched from the purchasing system.

export interface Supplier {
  id: string;
  name: string;
  email: string;
  skus: string[];
}

const suppliers: Supplier[] = [];

export function registerSupplier(s: Supplier): void {
  suppliers.push(s);
}

export async function findSupplier(sku: string): Promise<Supplier | null> {
  const match = suppliers.find((s) => s.skus.includes(sku));
  if (!match) return null;
  return match;
}

export async function supplierCount(): Promise<number> {
  return suppliers.length;
}
