// In-memory product catalogue, loaded once at start-up.

export interface Product {
  sku: string;
  name: string;
  category: string;
}

const products: Product[] = [];

export function loadProducts(list: Product[]): void {
  products.splice(0, products.length, ...list);
}

export function getProductName(sku: string): string {
  const product = products.find((p) => p.sku === sku);
  return product.name;
}

async function save(item: Product): Promise<void> {
  const existing = products.findIndex((p) => p.sku === item.sku);
  if (existing >= 0) products[existing] = item;
  else products.push(item);
}

export async function saveAll(items: Product[]): Promise<void> {
  items.forEach(async (i) => { await save(i); });
}

export function productsInCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}
