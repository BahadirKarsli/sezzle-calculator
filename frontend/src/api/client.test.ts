import { vi } from 'vitest';
import { CalculatorApiError, createCalculatorApi } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createCalculatorApi', () => {
  it('posts operands to the operation endpoint and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { operation: 'add', operands: [2, 3], result: 5 }),
    );
    const api = createCalculatorApi('http://api.test/', fetchMock);

    await expect(api.calculate('add', 2, 3)).resolves.toBe(5);
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/v1/calculate/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 2, b: 3 }),
    });
  });

  it('omits b for unary operations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: 3 }));
    await createCalculatorApi('', fetchMock).calculate('sqrt', 9);
    expect(fetchMock.mock.calls[0]![1].body).toBe(JSON.stringify({ a: 9 }));
  });

  it('surfaces API error codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(422, { error: { code: 'DIVISION_BY_ZERO', message: 'division by zero' } }),
    );
    const error = await createCalculatorApi('', fetchMock).calculate('divide', 1, 0).catch((e) => e);
    expect(error).toBeInstanceOf(CalculatorApiError);
    expect(error).toMatchObject({ code: 'DIVISION_BY_ZERO', status: 422, message: 'division by zero' });
  });

  it('reports network failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(createCalculatorApi('', fetchMock).calculate('add', 1, 1)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('reports non-JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(createCalculatorApi('', fetchMock).calculate('add', 1, 1)).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 502,
    });
  });

  it('reports error responses without an error envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { oops: true }));
    await expect(createCalculatorApi('', fetchMock).calculate('add', 1, 1)).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 500,
    });
  });

  it('reports success responses without a numeric result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: '5' }));
    await expect(createCalculatorApi('', fetchMock).calculate('add', 2, 3)).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });
});
