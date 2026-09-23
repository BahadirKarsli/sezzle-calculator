import { MAX_INPUT_DIGITS } from '../lib/format';
import {
  calculatorReducer as reduce,
  initialState,
  type CalculatorAction,
  type CalculatorState,
} from './calculatorReducer';

const run = (actions: CalculatorAction[], from: CalculatorState = initialState) =>
  actions.reduce(reduce, from);

const digits = (s: string): CalculatorAction[] =>
  [...s].map((c) => (c === '.' ? { type: 'decimal' } : { type: 'digit', digit: c }));

describe('calculatorReducer', () => {
  describe('entering numbers', () => {
    it('replaces the leading zero', () => {
      expect(run(digits('07')).display).toBe('7');
    });

    it('builds multi-digit decimals', () => {
      expect(run(digits('12.50')).display).toBe('12.50');
    });

    it('allows only one decimal point', () => {
      expect(run(digits('1..2.')).display).toBe('1.2');
    });

    it('starts with "0." when the decimal point comes first', () => {
      expect(run(digits('.5')).display).toBe('0.5');
    });

    it('limits input length', () => {
      const state = run(digits('9'.repeat(MAX_INPUT_DIGITS + 5)));
      expect(state.display).toHaveLength(MAX_INPUT_DIGITS);
    });

    it('toggles the sign and keeps typing', () => {
      const state = run([{ type: 'toggleSign' }, ...digits('5')]);
      expect(state.display).toBe('-5');
      expect(run([{ type: 'toggleSign' }], state).display).toBe('5');
    });

    it('backspaces down to zero', () => {
      expect(run([...digits('12'), { type: 'backspace' }]).display).toBe('1');
      expect(run([{ type: 'backspace' }], { ...initialState, display: '-3' }).display).toBe('0');
      expect(run([{ type: 'backspace' }]).display).toBe('0');
    });
  });

  describe('operators and results', () => {
    const afterOperator = run([...digits('12'), { type: 'chooseOperator', op: 'multiply', value: 12 }]);

    it('stores the left operand and shows the pending expression', () => {
      expect(afterOperator).toMatchObject({
        accumulator: 12,
        pendingOp: 'multiply',
        awaitingOperand: true,
        expression: '12 ×',
      });
    });

    it('starts a new operand after an operator', () => {
      expect(run(digits('3'), afterOperator)).toMatchObject({ display: '3', awaitingOperand: false });
    });

    it('does not edit the left operand with backspace', () => {
      expect(run([{ type: 'backspace' }], afterOperator).display).toBe('12');
    });

    it('starts a negative operand when ± is pressed right after an operator', () => {
      expect(run([{ type: 'toggleSign' }, ...digits('4')], afterOperator).display).toBe('-4');
    });

    it('shows a final result and lets the next digit replace it', () => {
      const result = run(
        [{ type: 'requestStarted' }, { type: 'binaryResult', value: 36, nextOp: null, expression: '12 × 3 =' }],
        afterOperator,
      );
      expect(result).toMatchObject({ display: '36', pendingOp: null, expression: '12 × 3 =', loading: false });
      expect(run(digits('5'), result).display).toBe('5');
      expect(run([{ type: 'backspace' }], result).display).toBe('36');
    });

    it('chains into the next operator', () => {
      const state = run([{ type: 'binaryResult', value: 36, nextOp: 'add', expression: '' }], afterOperator);
      expect(state).toMatchObject({ accumulator: 36, pendingOp: 'add', expression: '36 +', awaitingOperand: true });
    });

    it('replaces the operand after a unary result but keeps the pending operation', () => {
      const state = run([{ type: 'operandReplaced', value: 4 }], { ...afterOperator, awaitingOperand: false });
      expect(state).toMatchObject({ display: '4', pendingOp: 'multiply', expression: '12 ×', overwrite: true });
    });
  });

  describe('loading and errors', () => {
    it('ignores input while a request is in flight', () => {
      const loading = run([...digits('1'), { type: 'requestStarted' }]);
      expect(run(digits('2'), loading)).toBe(loading);
    });

    it('clear always resets, even while loading', () => {
      const loading = run([...digits('1'), { type: 'requestStarted' }]);
      expect(run([{ type: 'clear' }], loading)).toEqual(initialState);
    });

    it('shows an error and clears it on the next input, keeping the typed value', () => {
      const failed = run([...digits('8'), { type: 'requestStarted' }, { type: 'requestFailed', message: 'nope' }]);
      expect(failed).toMatchObject({ error: 'nope', loading: false, display: '8' });
      expect(run([{ type: 'backspace' }], failed)).toMatchObject({ error: null, display: '0' });
    });
  });
});
