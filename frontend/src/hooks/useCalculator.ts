import { useCallback, useMemo, useReducer, useRef } from 'react';
import type { CalculatorApi } from '../api/client';
import type { BinaryOperation, Operation } from '../api/types';
import { describeError } from '../lib/errors';
import { formatNumber, parseOperand } from '../lib/format';
import {
  calculatorReducer,
  initialState,
  OPERATOR_SYMBOLS,
  type CalculatorState,
} from '../state/calculatorReducer';

export interface CalculatorControls {
  inputDigit(digit: string): void;
  inputDecimal(): void;
  backspace(): void;
  toggleSign(): void;
  clear(): void;
  chooseOperator(op: BinaryOperation): Promise<void>;
  equals(): Promise<void>;
  squareRoot(): Promise<void>;
  percent(): Promise<void>;
}

/**
 * Owns calculator state. Input editing is handled synchronously by the
 * reducer; every arithmetic operation is delegated to the backend API.
 */
export function useCalculator(api: CalculatorApi): [CalculatorState, CalculatorControls] {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);

  // Async handlers read the latest state through a ref so rapid key presses
  // never act on a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Bumped on "clear" so a response that arrives afterwards is discarded.
  const generation = useRef(0);

  const request = useCallback(
    async (op: Operation, a: number, b?: number): Promise<number | null> => {
      const startedIn = generation.current;
      dispatch({ type: 'requestStarted' });
      try {
        const result = await api.calculate(op, a, b);
        return startedIn === generation.current ? result : null;
      } catch (error) {
        if (startedIn === generation.current) {
          dispatch({ type: 'requestFailed', message: describeError(error) });
        }
        return null;
      }
    },
    [api],
  );

  /** Parses the current display, reporting a validation error if it is not a number. */
  const readDisplay = useCallback((): number | null => {
    const parsed = parseOperand(stateRef.current.display);
    if (!parsed.ok) {
      dispatch({ type: 'requestFailed', message: parsed.error });
      return null;
    }
    return parsed.value;
  }, []);

  const chooseOperator = useCallback(
    async (op: BinaryOperation) => {
      const s = stateRef.current;
      if (s.loading) return;
      const value = readDisplay();
      if (value === null) return;

      const canChain = s.pendingOp !== null && s.accumulator !== null && !s.awaitingOperand;
      if (!canChain) {
        dispatch({ type: 'chooseOperator', op, value });
        return;
      }
      const result = await request(s.pendingOp!, s.accumulator!, value);
      if (result !== null) {
        dispatch({ type: 'binaryResult', value: result, nextOp: op, expression: '' });
      }
    },
    [readDisplay, request],
  );

  const equals = useCallback(async () => {
    const s = stateRef.current;
    if (s.loading || s.pendingOp === null || s.accumulator === null) return;
    // "5 × =" repeats the left operand (5 × 5), like most handheld calculators.
    const right = s.awaitingOperand ? s.accumulator : readDisplay();
    if (right === null) return;

    const result = await request(s.pendingOp, s.accumulator, right);
    if (result !== null) {
      const expression = `${formatNumber(s.accumulator)} ${OPERATOR_SYMBOLS[s.pendingOp]} ${formatNumber(right)} =`;
      dispatch({ type: 'binaryResult', value: result, nextOp: null, expression });
    }
  }, [readDisplay, request]);

  const squareRoot = useCallback(async () => {
    const s = stateRef.current;
    if (s.loading) return;
    const value = readDisplay();
    if (value === null) return;

    const result = await request('sqrt', value);
    if (result !== null) {
      // Standalone √ gets its own expression; inside "a + √b" keep "a +".
      const expression = s.pendingOp ? undefined : `√(${formatNumber(value)}) =`;
      dispatch({ type: 'operandReplaced', value: result, expression });
    }
  }, [readDisplay, request]);

  const percent = useCallback(async () => {
    const s = stateRef.current;
    if (s.loading) return;
    const value = readDisplay();
    if (value === null) return;

    // "200 + 10 %" means 10% of 200; otherwise % simply divides by 100.
    const relative =
      (s.pendingOp === 'add' || s.pendingOp === 'subtract') && s.accumulator !== null;
    const base = relative ? s.accumulator! : 1;

    const result = await request('percentage', value, base);
    if (result !== null) {
      dispatch({ type: 'operandReplaced', value: result });
    }
  }, [readDisplay, request]);

  const controls = useMemo<CalculatorControls>(
    () => ({
      inputDigit: (digit) => dispatch({ type: 'digit', digit }),
      inputDecimal: () => dispatch({ type: 'decimal' }),
      backspace: () => dispatch({ type: 'backspace' }),
      toggleSign: () => dispatch({ type: 'toggleSign' }),
      clear: () => {
        generation.current += 1;
        dispatch({ type: 'clear' });
      },
      chooseOperator,
      equals,
      squareRoot,
      percent,
    }),
    [chooseOperator, equals, squareRoot, percent],
  );

  return [state, controls];
}
