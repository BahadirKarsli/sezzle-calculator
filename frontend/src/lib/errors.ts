import { CalculatorApiError } from '../api/client';
import { CLIENT_ERROR } from '../api/types';

const MESSAGES: Record<string, string> = {
  DIVISION_BY_ZERO: "Can't divide by zero. Enter a different divisor.",
  UNDEFINED_RESULT: "That result isn't a real number.",
  OUT_OF_RANGE: 'That result is too large to display.',
  [CLIENT_ERROR.network]: "Can't reach the calculator service. Check that the backend is running.",
  [CLIENT_ERROR.badResponse]: 'The calculator service sent an unexpected response.',
};

/** Turns any thrown value into a message suitable for the UI. */
export function describeError(error: unknown): string {
  if (error instanceof CalculatorApiError) {
    return MESSAGES[error.code] ?? error.message;
  }
  return 'Something went wrong. Try again.';
}
