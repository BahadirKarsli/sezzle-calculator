import { useEffect } from 'react';
import type { CalculatorApi } from '../api/client';
import type { BinaryOperation } from '../api/types';
import { useCalculator, type CalculatorControls } from '../hooks/useCalculator';
import { Display } from './Display';
import { Keypad } from './Keypad';

const KEY_OPERATORS: Record<string, BinaryOperation> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  '/': 'divide',
  '^': 'power',
};

/** Maps a physical key to a calculator control. Returns false if unhandled. */
export function handleKey(key: string, c: CalculatorControls): boolean {
  if (/^[0-9]$/.test(key)) c.inputDigit(key);
  else if (key === '.' || key === ',') c.inputDecimal();
  else if (key in KEY_OPERATORS) void c.chooseOperator(KEY_OPERATORS[key]!);
  else if (key === 'Enter' || key === '=') void c.equals();
  else if (key === '%') void c.percent();
  else if (key === 'r') void c.squareRoot();
  else if (key === 'Backspace') c.backspace();
  else if (key === 'Escape' || key === 'Delete') c.clear();
  else return false;
  return true;
}

export function Calculator({ api }: { api: CalculatorApi }) {
  const [state, controls] = useCalculator(api);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Let Enter/Space activate a focused button normally.
      if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) {
        return;
      }
      if (handleKey(event.key, controls)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controls]);

  return (
    <section className="calculator" aria-label="Calculator">
      <Display
        value={state.display}
        expression={state.expression}
        error={state.error}
        loading={state.loading}
      />
      <Keypad
        controls={controls}
        activeOperator={state.awaitingOperand ? state.pendingOp : null}
        disabled={state.loading}
      />
    </section>
  );
}
