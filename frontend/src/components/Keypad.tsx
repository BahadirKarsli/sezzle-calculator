import type { BinaryOperation } from '../api/types';
import type { CalculatorControls } from '../hooks/useCalculator';

type Variant = 'digit' | 'operator' | 'function' | 'equals' | 'advanced';

interface KeyDef {
  label: string;
  name: string;
  variant: Variant;
  run: (c: CalculatorControls) => void;
  operator?: BinaryOperation;
  wide?: boolean;
}

const digit = (d: string): KeyDef => ({
  label: d,
  name: d,
  variant: 'digit',
  run: (c) => c.inputDigit(d),
});

const operator = (op: BinaryOperation, label: string, name: string, variant: Variant = 'operator'): KeyDef => ({
  label,
  name,
  variant,
  operator: op,
  run: (c) => void c.chooseOperator(op),
});

const ADVANCED_KEYS: KeyDef[] = [
  { label: '√x', name: 'Square root', variant: 'advanced', run: (c) => void c.squareRoot(), wide: true },
  { ...operator('power', 'xʸ', 'Power', 'advanced'), wide: true },
];

const MAIN_KEYS: KeyDef[] = [
  { label: 'AC', name: 'All clear', variant: 'function', run: (c) => c.clear() },
  { label: '⌫', name: 'Backspace', variant: 'function', run: (c) => c.backspace() },
  { label: '%', name: 'Percent', variant: 'function', run: (c) => void c.percent() },
  operator('divide', '÷', 'Divide'),
  digit('7'), digit('8'), digit('9'),
  operator('multiply', '×', 'Multiply'),
  digit('4'), digit('5'), digit('6'),
  operator('subtract', '−', 'Subtract'),
  digit('1'), digit('2'), digit('3'),
  operator('add', '+', 'Add'),
  { label: '±', name: 'Toggle sign', variant: 'function', run: (c) => c.toggleSign() },
  digit('0'),
  { label: '.', name: 'Decimal point', variant: 'digit', run: (c) => c.inputDecimal() },
  { label: '=', name: 'Equals', variant: 'equals', run: (c) => void c.equals() },
];

interface KeypadProps {
  controls: CalculatorControls;
  /** Operator to highlight while the calculator waits for the next operand. */
  activeOperator: BinaryOperation | null;
  disabled: boolean;
}

export function Keypad({ controls, activeOperator, disabled }: KeypadProps) {
  const renderKey = (key: KeyDef) => (
    <button
      key={key.name}
      type="button"
      className={`key key--${key.variant}${key.wide ? ' key--wide' : ''}`}
      aria-label={key.name}
      aria-pressed={key.operator ? key.operator === activeOperator : undefined}
      disabled={disabled && key.name !== 'All clear'}
      onClick={() => key.run(controls)}
    >
      {key.label}
    </button>
  );

  return (
    <div className="keypad">
      <div className="keypad__advanced">{ADVANCED_KEYS.map(renderKey)}</div>
      <div className="keypad__main">{MAIN_KEYS.map(renderKey)}</div>
    </div>
  );
}
