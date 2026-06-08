export interface FuelConfig {
  pricePerLitre: number;
  consumptionLPer100km: number;
}

const EUR_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function parseFuelInput(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return Number.NaN;
  return Number.parseFloat(trimmed.replace(",", "."));
}

export function isFuelConfigValid(c: FuelConfig): boolean {
  return Number.isFinite(c.pricePerLitre)
    && c.pricePerLitre > 0
    && Number.isFinite(c.consumptionLPer100km)
    && c.consumptionLPer100km > 0;
}

export function computeFuelCost(distanceMeters: number, c: FuelConfig): { oneway: number; twoway: number } {
  const oneway = (distanceMeters / 1000) * (c.consumptionLPer100km / 100) * c.pricePerLitre;
  return { oneway, twoway: oneway * 2 };
}

export function formatEur(value: number): string {
  return EUR_FORMATTER.format(value);
}

export function fuelCostText(distanceMeters: number, c: FuelConfig): string | null {
  if (!isFuelConfigValid(c) || !Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  const { oneway, twoway } = computeFuelCost(distanceMeters, c);
  return `${formatEur(oneway)} ⇄ ${formatEur(twoway)}`;
}
