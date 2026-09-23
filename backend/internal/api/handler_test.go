package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/bahadirkarsli/sezzle-calculator/backend/internal/calculator"
)

func do(t *testing.T, h http.Handler, method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) apiError {
	t.Helper()
	var env struct {
		Error apiError `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not an error envelope: %v (%s)", err, rec.Body.String())
	}
	return env.Error
}

func TestCalculateSuccess(t *testing.T) {
	h := NewHandler(Config{})

	tests := []struct {
		path string
		body string
		want float64
	}{
		{"/api/v1/calculate/add", `{"a": 2, "b": 3}`, 5},
		{"/api/v1/calculate/subtract", `{"a": 2, "b": 3}`, -1},
		{"/api/v1/calculate/multiply", `{"a": 1.5, "b": 4}`, 6},
		{"/api/v1/calculate/divide", `{"a": 10, "b": 4}`, 2.5},
		{"/api/v1/calculate/power", `{"a": 2, "b": 8}`, 256},
		{"/api/v1/calculate/sqrt", `{"a": 81}`, 9},
		{"/api/v1/calculate/percentage", `{"a": 15, "b": 80}`, 12},
		{"/api/v1/calculate/add", `{"a": 0, "b": 0}`, 0},
	}
	for _, tt := range tests {
		t.Run(tt.path+" "+tt.body, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tt.path, tt.body, nil)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Fatalf("content-type = %q", ct)
			}
			var resp CalculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if resp.Result != tt.want {
				t.Fatalf("result = %v, want %v", resp.Result, tt.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	h := NewHandler(Config{})

	tests := []struct {
		name       string
		path       string
		body       string
		headers    map[string]string
		wantStatus int
		wantCode   ErrorCode
	}{
		{"division by zero", "/api/v1/calculate/divide", `{"a": 1, "b": 0}`, nil, 422, CodeDivisionByZero},
		{"negative sqrt", "/api/v1/calculate/sqrt", `{"a": -9}`, nil, 422, CodeUndefinedResult},
		{"undefined power", "/api/v1/calculate/power", `{"a": -8, "b": 0.5}`, nil, 422, CodeUndefinedResult},
		{"overflow", "/api/v1/calculate/power", `{"a": 10, "b": 400}`, nil, 422, CodeOutOfRange},
		{"unknown operation", "/api/v1/calculate/modulo", `{"a": 1, "b": 2}`, nil, 404, CodeUnsupportedOperation},
		{"missing a", "/api/v1/calculate/add", `{"b": 2}`, nil, 400, CodeInvalidOperands},
		{"missing b", "/api/v1/calculate/add", `{"a": 2}`, nil, 400, CodeInvalidOperands},
		{"b given to unary op", "/api/v1/calculate/sqrt", `{"a": 4, "b": 2}`, nil, 400, CodeInvalidOperands},
		{"string operand", "/api/v1/calculate/add", `{"a": "2", "b": 3}`, nil, 400, CodeInvalidJSON},
		{"null operand", "/api/v1/calculate/add", `{"a": null, "b": 3}`, nil, 400, CodeInvalidOperands},
		{"unknown field", "/api/v1/calculate/add", `{"a": 1, "b": 2, "c": 3}`, nil, 400, CodeInvalidJSON},
		{"malformed json", "/api/v1/calculate/add", `{"a": 1,`, nil, 400, CodeInvalidJSON},
		{"number too large for float64", "/api/v1/calculate/add", `{"a": 1e400, "b": 1}`, nil, 400, CodeInvalidJSON},
		{"multiple objects", "/api/v1/calculate/add", `{"a": 1, "b": 2}{"a": 3}`, nil, 400, CodeInvalidJSON},
		{"array body", "/api/v1/calculate/add", `[1, 2]`, nil, 400, CodeInvalidJSON},
		{"empty body", "/api/v1/calculate/add", ``,
			map[string]string{"Content-Type": "application/json"}, 400, CodeInvalidJSON},
		{"wrong content type", "/api/v1/calculate/add", `{"a": 1, "b": 2}`,
			map[string]string{"Content-Type": "text/plain"}, 415, CodeUnsupportedMediaType},
		{"body too large", "/api/v1/calculate/add", `{"a": 1, "b": 2` + strings.Repeat(" ", 2048) + `}`,
			nil, 413, CodePayloadTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tt.path, tt.body, tt.headers)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got.Code != tt.wantCode || got.Message == "" {
				t.Fatalf("error = %+v, want code %s with a message", got, tt.wantCode)
			}
		})
	}
}

func TestMethodNotAllowed(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodGet, "/api/v1/calculate/add", "", nil)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestListOperations(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodGet, "/api/v1/operations", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Operations []struct {
			Name  string `json:"name"`
			Arity int    `json:"arity"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Operations) != 7 {
		t.Fatalf("got %d operations, want 7", len(body.Operations))
	}
}

func TestHealth(t *testing.T) {
	rec := do(t, NewHandler(Config{}), http.MethodGet, "/healthz", "", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestCORS(t *testing.T) {
	h := NewHandler(Config{AllowedOrigins: []string{"http://localhost:5173"}})

	t.Run("preflight from allowed origin", func(t *testing.T) {
		rec := do(t, h, http.MethodOptions, "/api/v1/calculate/add", "",
			map[string]string{"Origin": "http://localhost:5173"})
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
			t.Fatalf("allow-origin = %q", got)
		}
	})

	t.Run("disallowed origin gets no CORS headers", func(t *testing.T) {
		rec := do(t, h, http.MethodPost, "/api/v1/calculate/add", `{"a":1,"b":1}`,
			map[string]string{"Origin": "https://evil.example"})
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("allow-origin = %q, want empty", got)
		}
	})

	t.Run("wildcard allows any origin", func(t *testing.T) {
		h := NewHandler(Config{AllowedOrigins: []string{"*"}})
		rec := do(t, h, http.MethodPost, "/api/v1/calculate/add", `{"a":1,"b":1}`,
			map[string]string{"Origin": "https://anything.example"})
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://anything.example" {
			t.Fatalf("allow-origin = %q", got)
		}
	})
}

func TestRecovererReturnsJSON500(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := recoverer(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rec := do(t, h, http.MethodGet, "/", "", nil)
	if rec.Code != http.StatusInternalServerError || decodeError(t, rec).Code != CodeInternal {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestStaticSPA(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := NewHandler(Config{StaticDir: dir})

	cases := []struct {
		path, wantBody string
		wantStatus     int
	}{
		{"/", "app", 200},
		{"/app.js", "console.log", 200},
		{"/some/client/route", "app", 200},
		{"/api/v1/unknown", "NOT_FOUND", 404},
	}
	for _, c := range cases {
		rec := do(t, h, http.MethodGet, c.path, "", nil)
		if rec.Code != c.wantStatus || !strings.Contains(rec.Body.String(), c.wantBody) {
			t.Fatalf("%s: status = %d, body = %q", c.path, rec.Code, rec.Body.String())
		}
	}
	// API routes still take precedence over the static fallback.
	if rec := do(t, h, http.MethodGet, "/api/v1/operations", "", nil); rec.Code != 200 {
		t.Fatalf("operations status = %d", rec.Code)
	}
}

func TestClassifyCoversEveryDomainError(t *testing.T) {
	cases := []struct {
		err        error
		wantStatus int
		wantCode   ErrorCode
	}{
		{calculator.ErrInvalidOperands, 400, CodeInvalidOperands},
		{calculator.ErrUnsupportedOperation, 404, CodeUnsupportedOperation},
		{errors.New("something unexpected"), 500, CodeInternal},
	}
	for _, c := range cases {
		status, code := classify(fmt.Errorf("wrapped: %w", c.err))
		if status != c.wantStatus || code != c.wantCode {
			t.Errorf("classify(%v) = %d %s, want %d %s", c.err, status, code, c.wantStatus, c.wantCode)
		}
	}
}
