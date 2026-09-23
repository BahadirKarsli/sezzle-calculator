// Package api exposes the calculator over a small JSON REST interface.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"

	"github.com/bahadirkarsli/sezzle-calculator/backend/internal/calculator"
)

// maxBodyBytes caps request bodies; a calculation request is a few dozen bytes.
const maxBodyBytes = 1 << 10

// CalculateRequest is the body accepted by POST /api/v1/calculate/{operation}.
//
// Pointers let us tell "missing" apart from an explicit zero.
type CalculateRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

// CalculateResponse is returned on a successful calculation.
type CalculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

// Config controls optional behaviour of the HTTP handler.
type Config struct {
	// AllowedOrigins enables CORS for the given origins ("*" allows any).
	// Empty disables CORS, which is fine when the UI is served same-origin.
	AllowedOrigins []string
	// StaticDir, if set, serves the built frontend (SPA) from this directory.
	StaticDir string
	Logger    *slog.Logger
}

// NewHandler wires routes and middleware into a single http.Handler.
func NewHandler(cfg Config) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/v1/operations", handleListOperations)
	mux.HandleFunc("POST /api/v1/calculate/{operation}", handleCalculate)
	if cfg.StaticDir != "" {
		mux.Handle("GET /", spaHandler(cfg.StaticDir))
	}

	var h http.Handler = mux
	h = cors(cfg.AllowedOrigins, h)
	h = recoverer(logger, h)
	h = requestLogger(logger, h)
	return h
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleListOperations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"operations": calculator.Operations()})
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	op := calculator.Operation(r.PathValue("operation"))
	info, err := calculator.Lookup(op)
	if err != nil {
		writeError(w, http.StatusNotFound, CodeUnsupportedOperation,
			fmt.Sprintf("operation %q is not supported", op))
		return
	}

	if !isJSON(r) {
		writeError(w, http.StatusUnsupportedMediaType, CodeUnsupportedMediaType,
			"Content-Type must be application/json")
		return
	}

	req, apiErr := decodeRequest(w, r)
	if apiErr != nil {
		writeError(w, apiErr.status, apiErr.Code, apiErr.Message)
		return
	}

	operands, apiErr := operandsFor(info, req)
	if apiErr != nil {
		writeError(w, apiErr.status, apiErr.Code, apiErr.Message)
		return
	}

	result, err := calculator.Calculate(op, operands...)
	if err != nil {
		status, code := classify(err)
		writeError(w, status, code, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Operation: op, Operands: operands, Result: result})
}

func isJSON(r *http.Request) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	return err == nil && mediaType == "application/json"
}

func decodeRequest(w http.ResponseWriter, r *http.Request) (CalculateRequest, *apiError) {
	var req CalculateRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		switch {
		case errors.As(err, &maxErr):
			return req, newAPIError(http.StatusRequestEntityTooLarge, CodePayloadTooLarge,
				"request body is too large")
		case errors.Is(err, io.EOF):
			return req, newAPIError(http.StatusBadRequest, CodeInvalidJSON, "request body is empty")
		default:
			return req, newAPIError(http.StatusBadRequest, CodeInvalidJSON,
				"request body must be a JSON object with numeric fields \"a\" and \"b\": "+err.Error())
		}
	}
	if dec.More() {
		return req, newAPIError(http.StatusBadRequest, CodeInvalidJSON,
			"request body must contain a single JSON object")
	}
	return req, nil
}

// operandsFor maps the request onto the operand list for the operation,
// enforcing that exactly the operands the operation needs are present.
func operandsFor(info calculator.Info, req CalculateRequest) ([]float64, *apiError) {
	if req.A == nil {
		return nil, newAPIError(http.StatusBadRequest, CodeInvalidOperands, `operand "a" is required`)
	}
	if info.Arity == 1 {
		if req.B != nil {
			return nil, newAPIError(http.StatusBadRequest, CodeInvalidOperands,
				fmt.Sprintf(`operation %q takes a single operand "a"; remove "b"`, info.Name))
		}
		return []float64{*req.A}, nil
	}
	if req.B == nil {
		return nil, newAPIError(http.StatusBadRequest, CodeInvalidOperands, `operand "b" is required`)
	}
	return []float64{*req.A, *req.B}, nil
}

// classify maps domain errors onto HTTP status codes and stable error codes.
func classify(err error) (int, ErrorCode) {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, CodeDivisionByZero
	case errors.Is(err, calculator.ErrNegativeSqrt), errors.Is(err, calculator.ErrUndefinedResult):
		return http.StatusUnprocessableEntity, CodeUndefinedResult
	case errors.Is(err, calculator.ErrOutOfRange):
		return http.StatusUnprocessableEntity, CodeOutOfRange
	case errors.Is(err, calculator.ErrInvalidOperands):
		return http.StatusBadRequest, CodeInvalidOperands
	case errors.Is(err, calculator.ErrUnsupportedOperation):
		return http.StatusNotFound, CodeUnsupportedOperation
	default:
		return http.StatusInternalServerError, CodeInternal
	}
}
