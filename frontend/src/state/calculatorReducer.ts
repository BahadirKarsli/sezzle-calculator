import type { BinaryOperation } from '../api/types';
import { countDigits, formatNumber, MAX_INPUT_DIGITS } from '../lib/format';

export const OPERATOR_SYMBOLS: Record<BinaryOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
  percentage: '%',
};

export interface CalculatorState {
  /** What the main display shows: either the operand being typed or a result. */
  display: string;
  /** Left-hand operand waiting for the pending operator. */
  accumulator: number | null;
  pendingOp: BinaryOperation | null;
  /** The next digit replaces the display instead of appending to it. */
  overwrite: boolean;
  /** An operator was just chosen and no right-hand operand has been entered yet. */
  awaitingOperand: boolean;
  /** Secondary line above the display, e.g. "12 ×" or "12 × 3 =". */
  expression: string;
  loading: boolean;
  error: string | null;
}

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'toggleSign' }
  | { type: 'clear' }
  | { type: 'chooseOperator'; op: BinaryOperation; value: number }
  | { type: 'requestStarted' }
  | { type: 'requestFailed'; message: string }
  | { type: 'binaryResult'; value: number; nextOp: BinaryOperation | null; expression: string }
  | { type: 'operandReplaced'; value: number; expression?: string };

export const initialState: CalculatorState = {
  display: '0',
  accumulator: null,
  pendingOp: null,
  overwrite: false,
  awaitingOperand: false,
  expression: '',
  loading: false,
  error: null,
};

const pendingExpression = (value: number, op: BinaryOperation) =>
  `${formatNumber(value)} ${OPERATOR_SYMBOLS[op]}`;

/** Any user input clears a previous error, so the user can simply correct it. */
function startEditing(state: CalculatorState): CalculatorState {
  return state.error ? { ...state, error: null } : state;
}

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  // While a request is in flight, only "clear" and the request lifecycle are accepted.
  if (
    state.loading &&
    !['clear', 'requestFailed', 'binaryResult', 'operandReplaced'].includes(action.type)
  ) {
    return state;
  }

  switch (action.type) {
    case 'digit': {
      const s = startEditing(state);
      if (s.overwrite || s.awaitingOperand) {
        return { ...s, display: action.digit, overwrite: false, awaitingOperand: false };
      }
      if (countDigits(s.display) >= MAX_INPUT_DIGITS) return s;
      if (s.display === '0') return { ...s, display: action.digit };
      if (s.display === '-0') return { ...s, display: `-${action.digit}` };
      return { ...s, display: s.display + action.digit };
    }

    case 'decimal': {
      const s = startEditing(state);
      if (s.overwrite || s.awaitingOperand) {
        return { ...s, display: '0.', overwrite: false, awaitingOperand: false };
      }
      if (s.display.includes('.')) return s;
      return { ...s, display: `${s.display}.` };
    }

    case 'backspace': {
      const s = startEditing(state);
      // Results and operands that haven't been typed yet are not editable.
      if (s.overwrite || s.awaitingOperand) return s;
      const next = s.display.slice(0, -1);
      return { ...s, display: next === '' || next === '-' ? '0' : next };
    }

    case 'toggleSign': {
      const s = startEditing(state);
      if (s.awaitingOperand) {
        return { ...s, display: '-0', overwrite: false, awaitingOperand: false };
      }
      const display = s.display.startsWith('-') ? s.display.slice(1) : `-${s.display}`;
      return { ...s, display };
    }

    case 'clear':
      return initialState;

    case 'chooseOperator':
      return {
        ...startEditing(state),
        accumulator: action.value,
        pendingOp: action.op,
        display: formatNumber(action.value),
        awaitingOperand: true,
        overwrite: false,
        expression: pendingExpression(action.value, action.op),
      };

    case 'requestStarted':
      return { ...state, loading: true, error: null };

    case 'requestFailed':
      return { ...state, loading: false, error: action.message };

    case 'binaryResult': {
      const display = formatNumber(action.value);
      if (action.nextOp) {
        return {
          ...state,
          display,
          accumulator: action.value,
          pendingOp: action.nextOp,
          awaitingOperand: true,
          overwrite: false,
          expression: pendingExpression(action.value, action.nextOp),
          loading: false,
        };
      }
      return {
        ...state,
        display,
        accumulator: null,
        pendingOp: null,
        awaitingOperand: false,
        overwrite: true,
        expression: action.expression,
        loading: false,
      };
    }

    case 'operandReplaced':
      return {
        ...state,
        display: formatNumber(action.value),
        overwrite: true,
        awaitingOperand: false,
        expression: action.expression ?? state.expression,
        loading: false,
      };
  }
}
