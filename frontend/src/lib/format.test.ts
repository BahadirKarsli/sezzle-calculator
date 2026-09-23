import { countDigits, formatNumber, parseOperand } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [42, '42'],
    [-3.5, '-3.5'],
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333'],
    [123456789012, '123456789012'],
    [1e12, '1e+12'],
    [1.5e15, '1.5e+15'],
    [2.5e-7, '2.5e-7'],
    [0.000001, '0.000001'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it('rejects non-finite values', () => {
    expect(() => formatNumber(Infinity)).toThrow(RangeError);
    expect(() => formatNumber(NaN)).toThrow(RangeError);
  });
});

describe('parseOperand', () => {
  it.each([
    ['12', 12],
    ['-0.5', -0.5],
    ['3.', 3],
    ['1.5e+15', 1.5e15],
  ])('parses %s', (input, expected) => {
    expect(parseOperand(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '-', '.', 'abc', '1e999'])('rejects %j', (input) => {
    expect(parseOperand(input).ok).toBe(false);
  });
});

describe('countDigits', () => {
  it('ignores sign and decimal point', () => {
    expect(countDigits('-12.34')).toBe(4);
  });
});
