// Целочисленная арифметика без float: деньги ×100, курс ×10 000.

function assertInt(...values: number[]): void {
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new Error(`Ожидалось целое число: ${v}`);
  }
}

/** Целочисленное деление с округлением вниз (к −∞). */
export function floorDiv(a: number, b: number): number {
  assertInt(a, b);
  if (b === 0) throw new Error('Деление на ноль');
  return Number(bigFloorDiv(BigInt(a), BigInt(b)));
}

function bigFloorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
}

/** round(a × b / c), половина — от нуля. Точно для любых целых в пределах safe integer. */
export function mulDivRound(a: number, b: number, c: number): number {
  assertInt(a, b, c);
  if (c === 0) throw new Error('Деление на ноль');
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(c);
  const neg = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const q = (absNum * 2n + absDen) / (absDen * 2n);
  return Number(neg ? -q : q);
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
