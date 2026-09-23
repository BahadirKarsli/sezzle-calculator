import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App';

describe('<App />', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('talks to the same-origin API by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ operation: 'multiply', operands: [3, 3], result: 9 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    await userEvent.keyboard('3*3{Enter}');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate/multiply', expect.anything());
    expect(screen.getByTestId('display')).toHaveTextContent('9');
  });
});
