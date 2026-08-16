export const WINE_TYPES = [
  "Red",
  "White",
  "Rosé",
  "Sparkling",
  "Sweet",
  "Fortified",
] as const;

export type WineType = (typeof WINE_TYPES)[number];
