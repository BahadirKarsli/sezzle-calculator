# Full-stack Calculator

A calculator with a **React + TypeScript** frontend and a **Go** REST microservice.
The UI never does arithmetic itself: every operation (`+ − × ÷`, power, square root, percentage) is computed by the backend.

- Backend: Go 1.22, standard library only (no third-party dependencies)
- Frontend: React 18, TypeScript (strict), Vite, Vitest + Testing Library
- Tests: 100% statement coverage on the Go `calculator` and `api` packages, ~98% on the frontend ([reports](./coverage))
- One Docker image serves both the API and the UI

---

## Quick start

### Option A: Docker (one command)

```bash
docker build -t sezzle-calculator .
docker run --rm -p 8080:8080 sezzle-calculator
```

Open http://localhost:8080. The same container serves the UI at `/` and the API at `/api/v1`.

### Option B: Run locally

Requirements: Go 1.22+, Node.js 20+ (22 recommended).

```bash
# Terminal 1: backend on :8080
cd backend
go run ./cmd/server

# Terminal 2: frontend on :5173
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to `localhost:8080`, so no CORS setup is needed. (`make run-backend` / `make run-frontend` do the same.)

### Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | backend | `8080` | Port to listen on |
| `ALLOWED_ORIGINS` | backend | *(off)* | Comma-separated CORS origins, or `*`. Only needed if the UI is hosted on a different origin. |
| `STATIC_DIR` | backend | *(off)* | Directory of the built frontend to serve (set automatically in Docker) |
| `VITE_API_BASE_URL` | frontend build | `""` (same origin) | Absolute API URL if the backend lives elsewhere |
| `VITE_API_PROXY_TARGET` | frontend dev | `http://localhost:8080` | Where the dev server proxies `/api` |

---

## Tests and coverage

```bash
make test       # go vet + go test -race, then tsc + vitest
make coverage   # regenerates ./coverage/{backend.txt,backend.html,frontend.txt}
```

Or per layer:

```bash
cd backend  && go test -cover ./...
cd frontend && npm test            # npm run coverage for the report
```

Current numbers (see [`coverage/`](./coverage)):

| Layer | Statements |
|---|---|
| `backend/internal/calculator` | 100% |
| `backend/internal/api` | 100% |
| `backend` total (incl. `main`) | 95.8% |
| `frontend` | 98.5% |

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs formatting, vet, race-enabled tests, type checking, frontend tests with coverage, the production build, and the Docker build on every push.

---

## API

Base path: `/api/v1`. All responses are JSON.

### `POST /api/v1/calculate/{operation}`

Request body: `{"a": number, "b": number}`. Unary operations (`sqrt`) take only `a`.
`Content-Type: application/json` is required.

| Operation | Operands | Result |
|---|---|---|
| `add` | a, b | a + b |
| `subtract` | a, b | a − b |
| `multiply` | a, b | a × b |
| `divide` | a, b | a ÷ b |
| `power` | a, b | a raised to b |
| `sqrt` | a | √a |
| `percentage` | a, b | a percent of b, i.e. a / 100 × b |

```bash
curl -s -X POST localhost:8080/api/v1/calculate/add \
  -H 'Content-Type: application/json' -d '{"a": 2, "b": 3}'
# 200 {"operation":"add","operands":[2,3],"result":5}

curl -s -X POST localhost:8080/api/v1/calculate/sqrt \
  -H 'Content-Type: application/json' -d '{"a": 81}'
# 200 {"operation":"sqrt","operands":[81],"result":9}

curl -s -X POST localhost:8080/api/v1/calculate/percentage \
  -H 'Content-Type: application/json' -d '{"a": 15, "b": 80}'
# 200 {"operation":"percentage","operands":[15,80],"result":12}

curl -s -X POST localhost:8080/api/v1/calculate/divide \
  -H 'Content-Type: application/json' -d '{"a": 1, "b": 0}'
# 422 {"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}}
```

### `GET /api/v1/operations`

Lists supported operations with their arity and symbol, so clients can discover capabilities.

```bash
curl -s localhost:8080/api/v1/operations
# {"operations":[{"name":"add","arity":2,"symbol":"+","description":"a + b"}, ...]}
```

### `GET /healthz`

Liveness probe: `{"status":"ok"}`.

### Errors

Every error uses the same envelope, and clients should branch on `code`, not on `message`:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "division by zero" } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `INVALID_JSON` | Malformed JSON, non-numeric operand, unknown field, multiple JSON values, number outside float64 range |
| 400 | `INVALID_OPERANDS` | Missing `a`/`b`, or `b` sent to a unary operation |
| 404 | `UNSUPPORTED_OPERATION` | Unknown `{operation}` |
| 405 | – | Wrong HTTP method |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 1 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` is not `application/json` |
| 422 | `DIVISION_BY_ZERO` | `b` is 0 in `divide` |
| 422 | `UNDEFINED_RESULT` | Result is not a real number, e.g. `sqrt(-4)` or `(-8)^0.5` |
| 422 | `OUT_OF_RANGE` | Result overflows float64, e.g. `10^400` or `0^-1` |

---

## Design decisions

**Layered backend with a pure core.** `internal/calculator` knows nothing about HTTP; it takes floats and returns a float or a sentinel error. `internal/api` handles transport concerns (routing, decoding, validation, status codes). This keeps the arithmetic trivially unit-testable and lets the HTTP layer be tested with `httptest` without a running server.

**Operations as a registry.** Each operation is a single entry (name, arity, symbol, function) in a map. Adding modulo, say, is one entry plus tests; arity checks, `/operations` discovery and the HTTP route all follow from it automatically.

**One endpoint shape: `POST /calculate/{operation}` with named operands.** The operation lives in the path (it identifies the resource being invoked), the operands in the body. Named fields `a`/`b` are clearer than a positional array and give precise error messages ("operand `b` is required"). POST rather than GET because it is a computation with a structured body, and it keeps number parsing in JSON rather than query strings.

**Strict input validation.** Operands are decoded into `*float64` so a missing field is distinguishable from an explicit `0`. Unknown fields, trailing data, oversized bodies and wrong content types are rejected. A successful response is guaranteed to hold a finite number, because NaN and ±Inf cannot be encoded in JSON; they become `UNDEFINED_RESULT` / `OUT_OF_RANGE` instead. Negative zero is normalised to `0`.

**Stable error codes and meaningful statuses.** 400 for malformed requests, 422 for well-formed requests that are mathematically invalid. The frontend maps codes to user-facing copy ("Can't divide by zero. Enter a different divisor.") so wording can change without touching the API.

**Standard library only.** Go 1.22's `net/http` supports method and path-parameter routing, which is all this service needs. No framework means nothing to learn or patch. Also included: structured logging (`log/slog`), panic recovery, optional CORS, server timeouts and graceful shutdown on SIGINT/SIGTERM.

**Frontend state as a pure reducer.** All input editing (digits, decimal point, sign, backspace, operator selection, error and loading state) lives in `calculatorReducer`, a pure function with its own unit tests. The `useCalculator` hook is the only place that talks to the API; it reads the latest state through a ref so rapid key presses don't act on stale closures, and it discards a response that arrives after the user presses AC.

**Dependency injection for the API client.** `<Calculator api={...} />` receives a `CalculatorApi` interface. Production passes the `fetch`-based client; tests pass an in-memory fake, so component tests exercise real user flows without network mocks.

**Calculator behaviour.** Immediate-execution semantics, like a typical handheld calculator: `2 + 3 × 4 =` gives 20 (evaluated left to right), not 14. Other conventions:
- Pressing another operator before typing a number replaces the pending operator.
- `5 × =` repeats the left operand (25).
- `%` after `+`/`−` is relative to the left operand (`200 + 10 %` → 20, then `=` → 220); otherwise it divides by 100.
- `√` applies to the number on screen and can be used as the right operand (`10 + 16 √ =` → 14).
- Errors keep what you typed, so you can correct it (backspace, type a new divisor) instead of starting over.

**Number display.** The backend returns raw IEEE-754 doubles; the frontend rounds to 12 significant digits for display, which hides float noise (`0.1 + 0.2` shows `0.3`) and switches to exponent notation for very large or very small values. Input is capped at 15 digits.

**Deployment.** A multi-stage Dockerfile builds the frontend with Node, builds a static Go binary, and ships both on `distroless/static` as a non-root user. The Go server serves the SPA (with `index.html` fallback) and the API from one origin, so there is one container, one port, and no CORS.

**Accessibility and responsiveness.** Keys are real `<button>`s with accessible names and `aria-pressed` for the active operator, the result is an `aria-live` region, errors use `role="alert"`, focus is visible, and the layout works down to 320px wide. It follows the system dark mode and respects reduced motion. Keyboard shortcuts: digits, `.`, `+ - * / ^ %`, `r` (√), `Enter`/`=`, `Backspace`, `Esc`.

### Assumptions and trade-offs

- **Numbers are float64.** That's appropriate for a general calculator. A financial calculator would use a decimal type (e.g. `shopspring/decimal`) or integer minor units to avoid binary rounding.
- **No expression parser.** The brief asks for operation endpoints, so the backend evaluates one operation at a time and the frontend composes them. An `/evaluate` endpoint with operator precedence would be a natural extension.
- **No auth or rate limiting.** They're out of scope for this exercise. In production these would sit in front of the service (API gateway), alongside metrics and tracing.
- **Stateless service.** It holds no history or session, so it scales horizontally without coordination.

---

## Project structure

```
.
├── backend/
│   ├── cmd/server/          # entrypoint: config from env, graceful shutdown
│   └── internal/
│       ├── calculator/      # pure arithmetic + operation registry
│       └── api/             # routing, validation, error mapping, middleware, SPA serving
├── frontend/
│   └── src/
│       ├── api/             # typed API client + error type
│       ├── state/           # pure calculator reducer
│       ├── hooks/           # useCalculator: reducer <-> API
│       ├── components/      # Calculator, Display, Keypad
│       └── lib/             # number formatting/parsing, error messages
├── coverage/                # committed coverage reports
├── Dockerfile               # full-stack image
├── Makefile
└── .github/workflows/ci.yml
```

## AI usage

AI assistance was used; see [PROMPTS.md](./PROMPTS.md).
