/** Significant digits shown on the display; hides float noise like 0.1 + 0.2. */
const SIGNIFICANT_DIGITS = 12;
/** Maximum digits a user can type into a single operand. */
export const MAX_INPUT_DIGITS = 15;

const trimExponent = (s: string) => s.replace(/\.?0+e/, 'e');

/** Formats an API result for the display. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot display non-finite value ${value}`);
  }
  if (value === 0) return '0'; // also normalises -0

  const abs = Math.abs(value);
  if (abs >= 1e12 || abs < 1e-6) {
    return trimExponent(value.toExponential(6));
  }
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/** Parses the display string into a finite number before it is sent to the API. */
export function parseOperand(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '.') {
    return { ok: false, error: 'Enter a number first.' };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, error: `"${trimmed}" is not a valid number.` };
  }
  return { ok: true, value };
}

export function countDigits(input: string): number {
  return input.replace(/[^0-9]/g, '').length;
}
