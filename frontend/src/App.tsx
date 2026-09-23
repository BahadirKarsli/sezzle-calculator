import { useMemo } from 'react';
import { createCalculatorApi } from './api/client';
import { Calculator } from './components/Calculator';

export default function App() {
  const api = useMemo(() => createCalculatorApi(), []);

  return (
    <main className="page">
      <Calculator api={api} />
      <p className="page__hint">
        Works with your keyboard too: digits, + − * / ^ %, <kbd>r</kbd> for √, <kbd>Enter</kbd>{' '}
        to calculate, <kbd>Esc</kbd> to clear.
      </p>
    </main>
  );
}
