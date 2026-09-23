import { vi } from 'vitest';
import { CalculatorApiError, type CalculatorApi } from '../api/client';
import type { Operation } from '../api/types';

/** An in-memory stand-in for the backend with the same error semantics. */
export function createFakeApi() {
  const calculate = vi.fn(async (op: Operation, a: number, b?: number): Promise<number> => {
    const y = b ?? NaN;
    switch (op) {
      case 'add':
        return a + y;
      case 'subtract':
        return a - y;
      case 'multiply':
        return a * y;
      case 'divide':
        if (y === 0) throw new CalculatorApiError('division by zero', 'DIVISION_BY_ZERO', 422);
        return a / y;
      case 'power':
        return a ** y;
      case 'percentage':
        return (a / 100) * y;
      case 'sqrt':
        if (a < 0) throw new CalculatorApiError('negative sqrt', 'UNDEFINED_RESULT', 422);
        return Math.sqrt(a);
    }
  });
  return { calculate } satisfies CalculatorApi;
}
