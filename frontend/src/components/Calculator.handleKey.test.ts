import { vi } from 'vitest';
import type { CalculatorControls } from '../hooks/useCalculator';
import { handleKey } from './Calculator';

const controls = (): CalculatorControls => ({
  inputDigit: vi.fn(),
  inputDecimal: vi.fn(),
  backspace: vi.fn(),
  toggleSign: vi.fn(),
  clear: vi.fn(),
  chooseOperator: vi.fn().mockResolvedValue(undefined),
  equals: vi.fn().mockResolvedValue(undefined),
  squareRoot: vi.fn().mockResolvedValue(undefined),
  percent: vi.fn().mockResolvedValue(undefined),
});

describe('handleKey', () => {
  it.each([
    ['7', 'inputDigit'],
    [',', 'inputDecimal'],
    ['=', 'equals'],
    ['%', 'percent'],
    ['r', 'squareRoot'],
    ['Backspace', 'backspace'],
    ['Delete', 'clear'],
  ] as const)('maps %s to %s', (key, control) => {
    const c = controls();
    expect(handleKey(key, c)).toBe(true);
    expect(c[control]).toHaveBeenCalled();
  });

  it.each([
    ['/', 'divide'],
    ['x', 'multiply'],
    ['^', 'power'],
    ['-', 'subtract'],
  ])('maps %s to the %s operator', (key, op) => {
    const c = controls();
    handleKey(key, c);
    expect(c.chooseOperator).toHaveBeenCalledWith(op);
  });

  it('ignores unrelated keys', () => {
    expect(handleKey('a', controls())).toBe(false);
  });
});
