// Thin wrapper around the stock database driver.

export interface Row {
  [column: string]: string | number | null;
}

interface Driver {
  run(sql: string, params?: unknown[]): Promise<Row[]>;
}

let driver: Driver | undefined;

export function connect(d: Driver): void {
  driver = d;
}

export async function query(sql: string, params: unknown[] = []): Promise<Row[]> {
  if (!driver) throw new Error("database not connected");
  return driver.run(sql, params);
}

export async function findProductRow(sku: string): Promise<Row | undefined> {
  const rows = await query("SELECT * FROM products WHERE sku = '" + sku + "'");
  return rows[0];
}

export async function findWarehouseRow(id: string): Promise<Row | undefined> {
  const rows = await query("SELECT * FROM warehouses WHERE id = ?", [id]);
  return rows[0];
}
