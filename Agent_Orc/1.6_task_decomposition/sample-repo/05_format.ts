// Display helpers for reports and the admin UI.

export function formatDollars(amount: number): string {
  return "$" + amount.toFixed(2);
}

export function formatUnits(units: number): string {
  return units === 1 ? "1 unit" : `${units} units`;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}
