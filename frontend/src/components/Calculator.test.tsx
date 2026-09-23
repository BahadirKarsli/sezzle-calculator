import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CalculatorApiError, type CalculatorApi } from '../api/client';
import { createFakeApi } from '../test/fakeApi';
import { Calculator } from './Calculator';

function setup(api: CalculatorApi = createFakeApi()) {
  const user = userEvent.setup();
  render(<Calculator api={api} />);
  const press = async (...names: string[]) => {
    for (const name of names) await user.click(screen.getByRole('button', { name }));
  };
  return { api, user, press, display: () => screen.getByTestId('display') };
}

describe('<Calculator />', () => {
  it('adds two numbers through the API', async () => {
    const { api, press, display } = setup();
    await press('1', '2', 'Add', '3', 'Equals');

    expect(display()).toHaveTextContent('15');
    expect(screen.getByTestId('expression')).toHaveTextContent('12 + 3 =');
    expect(api.calculate).toHaveBeenCalledWith('add', 12, 3);
  });

  it('chains operations left to right', async () => {
    const { press, display } = setup();
    await press('2', 'Add', '3', 'Multiply');
    expect(display()).toHaveTextContent('5');
    await press('4', 'Equals');
    expect(display()).toHaveTextContent('20');
  });

  it('highlights the pending operator and lets the user change it', async () => {
    const { api, press } = setup();
    await press('9', 'Add', 'Subtract');
    expect(screen.getByRole('button', { name: 'Subtract' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('aria-pressed', 'false');
    await press('4', 'Equals');
    expect(api.calculate).toHaveBeenCalledTimes(1);
    expect(api.calculate).toHaveBeenCalledWith('subtract', 9, 4);
  });

  it('shows a helpful message on division by zero and recovers', async () => {
    const { press, display } = setup();
    await press('8', 'Divide', '0', 'Equals');
    expect(screen.getByRole('alert')).toHaveTextContent("Can't divide by zero");

    await press('Backspace', '2', 'Equals');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(display()).toHaveTextContent('4');
  });

  it('computes square roots and powers', async () => {
    const { press, display } = setup();
    await press('8', '1', 'Square root');
    expect(display()).toHaveTextContent('9');
    await press('Power', '2', 'Equals');
    expect(display()).toHaveTextContent('81');
  });

  it('uses the square root as the right operand of a pending operation', async () => {
    const { press, display } = setup();
    await press('1', '0', 'Add', '1', '6', 'Square root', 'Equals');
    expect(display()).toHaveTextContent('14');
  });

  it('treats percent relative to the left operand for + and −', async () => {
    const { api, press, display } = setup();
    await press('2', '0', '0', 'Add', '1', '0', 'Percent');
    expect(api.calculate).toHaveBeenLastCalledWith('percentage', 10, 200);
    expect(display()).toHaveTextContent('20');
    await press('Equals');
    expect(display()).toHaveTextContent('220');
  });

  it('treats a standalone percent as divide by 100', async () => {
    const { press, display } = setup();
    await press('5', 'Percent');
    expect(display()).toHaveTextContent('0.05');
  });

  it('clears everything with AC', async () => {
    const { press, display } = setup();
    await press('7', 'Add', '1', 'All clear');
    expect(display()).toHaveTextContent('0');
    expect(screen.getByTestId('expression')).not.toHaveTextContent('+');
  });

  it('supports the keyboard', async () => {
    const { user, display } = setup();
    await user.keyboard('6*7{Enter}');
    expect(display()).toHaveTextContent('42');
    await user.keyboard('{Escape}');
    expect(display()).toHaveTextContent('0');
  });

  it('reports an unreachable backend', async () => {
    const api: CalculatorApi = {
      calculate: vi.fn().mockRejectedValue(new CalculatorApiError('x', 'NETWORK_ERROR')),
    };
    const { press } = setup(api);
    await press('1', 'Add', '1', 'Equals');
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the calculator service");
  });

  it('disables keys while waiting and ignores a response that arrives after AC', async () => {
    let resolve!: (n: number) => void;
    const api: CalculatorApi = {
      calculate: vi.fn(() => new Promise<number>((r) => (resolve = r))),
    };
    const { press, display } = setup(api);
    await press('2', 'Add', '2', 'Equals');

    expect(screen.getByRole('button', { name: '5' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'All clear' })).toBeEnabled();

    await press('All clear');
    await act(async () => resolve(4));
    expect(display()).toHaveTextContent('0');
  });
});
