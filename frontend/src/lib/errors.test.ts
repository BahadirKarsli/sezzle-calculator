import { CalculatorApiError } from '../api/client';
import { describeError } from './errors';

describe('describeError', () => {
  it('maps known codes to friendly messages', () => {
    expect(describeError(new CalculatorApiError('x', 'DIVISION_BY_ZERO'))).toMatch(/divide by zero/i);
    expect(describeError(new CalculatorApiError('x', 'NETWORK_ERROR'))).toMatch(/backend is running/);
  });

  it('falls back to the server message for unknown codes', () => {
    expect(describeError(new CalculatorApiError('operand "b" is required', 'INVALID_OPERANDS'))).toBe(
      'operand "b" is required',
    );
  });

  it('handles unexpected errors', () => {
    expect(describeError(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
