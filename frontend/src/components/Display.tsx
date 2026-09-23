interface DisplayProps {
  value: string;
  expression: string;
  error: string | null;
  loading: boolean;
}

/** Long values get a smaller type size so they never overflow the screen. */
function sizeClass(value: string): string {
  if (value.length > 14) return 'display__value--xs';
  if (value.length > 10) return 'display__value--sm';
  return '';
}

export function Display({ value, expression, error, loading }: DisplayProps) {
  return (
    <div className="display" aria-busy={loading}>
      <div className="display__expression" data-testid="expression">
        {expression || '\u00a0'}
      </div>
      <output
        className={`display__value ${sizeClass(value)}`}
        aria-live="polite"
        aria-label="Result"
        data-testid="display"
      >
        {value}
      </output>
      <p className="display__error" role={error ? 'alert' : undefined}>
        {error ?? '\u00a0'}
      </p>
    </div>
  );
}
