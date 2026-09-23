export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage';
export type UnaryOperation = 'sqrt';
export type Operation = BinaryOperation | UnaryOperation;

export interface CalculateResponse {
  operation: Operation;
  operands: number[];
  result: number;
}

export interface ErrorResponse {
  error: { code: string; message: string };
}

/** Error codes produced by the client itself rather than the server. */
export const CLIENT_ERROR = {
  network: 'NETWORK_ERROR',
  badResponse: 'BAD_RESPONSE',
  invalidInput: 'INVALID_INPUT',
} as const;
