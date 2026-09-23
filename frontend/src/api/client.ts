import { CLIENT_ERROR, type CalculateResponse, type ErrorResponse, type Operation } from './types';

export class CalculatorApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CalculatorApiError';
  }
}

export interface CalculatorApi {
  calculate(operation: Operation, a: number, b?: number): Promise<number>;
}

function isCalculateResponse(body: unknown): body is CalculateResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as CalculateResponse).result === 'number'
  );
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  const error = (body as ErrorResponse | null)?.error;
  return typeof error?.code === 'string' && typeof error?.message === 'string';
}

/**
 * Creates a client for the calculator REST API.
 *
 * `baseUrl` defaults to same-origin, which works both behind the Vite dev
 * proxy and when the Go server serves the built frontend.
 */
export function createCalculatorApi(
  baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '',
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): CalculatorApi {
  const root = baseUrl.replace(/\/+$/, '');

  return {
    async calculate(operation, a, b) {
      const body = b === undefined ? { a } : { a, b };

      let response: Response;
      try {
        response = await fetchImpl(`${root}/api/v1/calculate/${operation}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        throw new CalculatorApiError('Network request failed', CLIENT_ERROR.network);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new CalculatorApiError(
          `Unexpected response from server (HTTP ${response.status})`,
          CLIENT_ERROR.badResponse,
          response.status,
        );
      }

      if (!response.ok) {
        if (isErrorResponse(payload)) {
          throw new CalculatorApiError(payload.error.message, payload.error.code, response.status);
        }
        throw new CalculatorApiError(
          `Request failed (HTTP ${response.status})`,
          CLIENT_ERROR.badResponse,
          response.status,
        );
      }

      if (!isCalculateResponse(payload)) {
        throw new CalculatorApiError('Response did not include a result', CLIENT_ERROR.badResponse);
      }
      return payload.result;
    },
  };
}
