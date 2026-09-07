export type DesilValue = 1 | 2 | 3 | 4 | 5;

export type DesilBucket = {
  desil: DesilValue;
  label: string;
  count: number;
  percentage: number;
};

export const DESIL_VALUES = [1, 2, 3, 4, 5] as const;

export function normalizeDesil(value: number): DesilValue {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;

  return 5;
}

export function parseDesil(value: unknown): DesilValue | null {
  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue) ||
    !Number.isInteger(numericValue) ||
    numericValue < 1
  ) {
    return null;
  }

  return normalizeDesil(numericValue);
}

export function createDistribution(values: unknown[]): DesilBucket[] {
  const counts = new Map<DesilValue, number>(
    DESIL_VALUES.map((desil) => [desil, 0]),
  );

  for (const value of values) {
    const desil = parseDesil(value);

    if (desil === null) {
      continue;
    }

    counts.set(desil, (counts.get(desil) ?? 0) + 1);
  }

  const totalWithDesil = Array.from(counts.values()).reduce(
    (total, count) => total + count,
    0,
  );

  return DESIL_VALUES.map((desil) => {
    const count = counts.get(desil) ?? 0;

    return {
      desil,
      label: desil === 5 ? "Desil 5+" : `Desil ${desil}`,
      count,
      percentage:
        totalWithDesil === 0
          ? 0
          : Math.round((count / totalWithDesil) * 100),
    };
  });
}

export function createDistributionFromCounts(counts: number[]): DesilBucket[] {
  if (
    counts.length !== DESIL_VALUES.length ||
    counts.some((count) => !Number.isSafeInteger(count) || count < 0)
  ) {
    throw new Error("Hitungan distribusi desil tidak valid.");
  }

  const totalWithDesil = counts.reduce((total, count) => total + count, 0);

  return DESIL_VALUES.map((desil, index) => {
    const count = counts[index];

    return {
      desil,
      label: desil === 5 ? "Desil 5+" : `Desil ${desil}`,
      count,
      percentage:
        totalWithDesil === 0
          ? 0
          : Math.round((count / totalWithDesil) * 100),
    };
  });
}

export function combineDistributions(
  distributions: DesilBucket[][],
): DesilBucket[] {
  const counts = DESIL_VALUES.map((desil) =>
    distributions.reduce(
      (total, distribution) =>
        total +
        (distribution.find((bucket) => bucket.desil === desil)?.count ?? 0),
      0,
    ),
  );

  return createDistributionFromCounts(counts);
}

export function getDominantDesil(
  distribution: DesilBucket[],
): DesilValue | null {
  let dominantDesil: DesilValue | null = null;
  let highestCount = 0;

  for (const bucket of distribution) {
    if (bucket.count > highestCount) {
      dominantDesil = bucket.desil;
      highestCount = bucket.count;
    }
  }

  return dominantDesil;
}
