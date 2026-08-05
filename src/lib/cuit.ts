/**
 * Validates an Argentine CUIT/CUIL (11 digits, modulo-11 check digit).
 */
export function validateCuit(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || !/^\d{11}$/.test(digits)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const body = digits.slice(0, 10).split("").map(Number);
  const check = Number(digits[10]);

  const sum = body.reduce((acc, d, i) => acc + d * weights[i]!, 0);
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod === 10 ? 9 : mod;

  return check === expected;
}

export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, "");
}
