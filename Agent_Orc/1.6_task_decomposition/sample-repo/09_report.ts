// Daily stock value report, written to the reports store.

import { getUnitPrice } from "./04_pricing";
import { formatDollars, formatUnits } from "./05_format";

const store: string[][] = [];

async function saveReport(lines: string[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  store.push(lines);
}

export function stockValueLine(sku: string, units: number): string {
  return `${sku}: ${formatUnits(units)} worth ${formatDollars(getUnitPrice(sku) * units)}`;
}

export async function publishReport(lines: string[]): Promise<string> {
  saveReport(lines);
  return `published ${lines.length} lines`;
}

export function reportsSaved(): number {
  return store.length;
}
