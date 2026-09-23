package api

import (
	"encoding/json"
	"net/http"
)

// ErrorCode is a stable, machine-readable error identifier. Clients should
// branch on the code, never on the human-readable message.
type ErrorCode string

// Error codes returned by the API.
const (
	CodeInvalidJSON          ErrorCode = "INVALID_JSON"
	CodeInvalidOperands      ErrorCode = "INVALID_OPERANDS"
	CodeUnsupportedOperation ErrorCode = "UNSUPPORTED_OPERATION"
	CodeUnsupportedMediaType ErrorCode = "UNSUPPORTED_MEDIA_TYPE"
	CodePayloadTooLarge      ErrorCode = "PAYLOAD_TOO_LARGE"
	CodeDivisionByZero       ErrorCode = "DIVISION_BY_ZERO"
	CodeUndefinedResult      ErrorCode = "UNDEFINED_RESULT"
	CodeOutOfRange           ErrorCode = "OUT_OF_RANGE"
	CodeNotFound             ErrorCode = "NOT_FOUND"
	CodeInternal             ErrorCode = "INTERNAL_ERROR"
)

type apiError struct {
	status  int
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

func newAPIError(status int, code ErrorCode, message string) *apiError {
	return &apiError{status: status, Code: code, Message: message}
}

type errorEnvelope struct {
	Error *apiError `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	// Encoding our own well-typed values cannot fail in practice; if the
	// client has gone away there is nobody left to report the error to.
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code ErrorCode, message string) {
	writeJSON(w, status, errorEnvelope{Error: newAPIError(status, code, message)})
}
