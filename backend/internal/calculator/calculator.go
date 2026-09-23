// Package calculator implements the arithmetic core of the service.
//
// It is intentionally free of any HTTP or JSON concerns so that it can be
// tested exhaustively in isolation and reused by other transports.
package calculator

import (
	"errors"
	"fmt"
	"math"
	"sort"
)

// Operation identifies a supported arithmetic operation.
type Operation string

// Supported operations.
const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Sentinel errors returned by Calculate. Callers should use errors.Is.
var (
	ErrUnsupportedOperation = errors.New("unsupported operation")
	ErrInvalidOperands      = errors.New("invalid operands")
	ErrDivisionByZero       = errors.New("division by zero")
	ErrNegativeSqrt         = errors.New("square root of a negative number is not a real number")
	ErrUndefinedResult      = errors.New("result is undefined")
	ErrOutOfRange           = errors.New("result is out of range")
)

// Info describes an operation for discovery purposes.
type Info struct {
	Name        Operation `json:"name"`
	Arity       int       `json:"arity"`
	Symbol      string    `json:"symbol"`
	Description string    `json:"description"`
}

type definition struct {
	Info
	apply func(operands []float64) (float64, error)
}

var registry = map[Operation]definition{
	Add: {
		Info:  Info{Name: Add, Arity: 2, Symbol: "+", Description: "a + b"},
		apply: func(o []float64) (float64, error) { return o[0] + o[1], nil },
	},
	Subtract: {
		Info:  Info{Name: Subtract, Arity: 2, Symbol: "−", Description: "a − b"},
		apply: func(o []float64) (float64, error) { return o[0] - o[1], nil },
	},
	Multiply: {
		Info:  Info{Name: Multiply, Arity: 2, Symbol: "×", Description: "a × b"},
		apply: func(o []float64) (float64, error) { return o[0] * o[1], nil },
	},
	Divide: {
		Info: Info{Name: Divide, Arity: 2, Symbol: "÷", Description: "a ÷ b"},
		apply: func(o []float64) (float64, error) {
			if o[1] == 0 {
				return 0, ErrDivisionByZero
			}
			return o[0] / o[1], nil
		},
	},
	Power: {
		Info:  Info{Name: Power, Arity: 2, Symbol: "^", Description: "a raised to the power of b"},
		apply: func(o []float64) (float64, error) { return math.Pow(o[0], o[1]), nil },
	},
	Sqrt: {
		Info: Info{Name: Sqrt, Arity: 1, Symbol: "√", Description: "square root of a"},
		apply: func(o []float64) (float64, error) {
			if o[0] < 0 {
				return 0, ErrNegativeSqrt
			}
			return math.Sqrt(o[0]), nil
		},
	},
	Percentage: {
		Info:  Info{Name: Percentage, Arity: 2, Symbol: "%", Description: "a percent of b, i.e. a / 100 × b"},
		apply: func(o []float64) (float64, error) { return o[0] / 100 * o[1], nil },
	},
}

// Lookup returns metadata for op, or ErrUnsupportedOperation.
func Lookup(op Operation) (Info, error) {
	def, ok := registry[op]
	if !ok {
		return Info{}, fmt.Errorf("%w: %q", ErrUnsupportedOperation, op)
	}
	return def.Info, nil
}

// Operations lists every supported operation in a stable order.
func Operations() []Info {
	out := make([]Info, 0, len(registry))
	for _, def := range registry {
		out = append(out, def.Info)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// Calculate applies op to operands.
//
// It validates arity and finiteness of inputs, and guarantees that a nil
// error is only ever returned together with a finite result, because NaN
// and ±Inf cannot be represented in JSON and are never a useful answer.
func Calculate(op Operation, operands ...float64) (float64, error) {
	def, ok := registry[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnsupportedOperation, op)
	}
	if len(operands) != def.Arity {
		return 0, fmt.Errorf("%w: %s expects %d operand(s), got %d",
			ErrInvalidOperands, op, def.Arity, len(operands))
	}
	for _, v := range operands {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, fmt.Errorf("%w: operands must be finite numbers", ErrInvalidOperands)
		}
	}

	result, err := def.apply(operands)
	if err != nil {
		return 0, err
	}
	switch {
	case math.IsNaN(result):
		return 0, ErrUndefinedResult
	case math.IsInf(result, 0):
		return 0, ErrOutOfRange
	}
	// Normalise negative zero (e.g. -1 × 0) so clients never render "-0".
	if result == 0 {
		result = 0
	}
	return result, nil
}
