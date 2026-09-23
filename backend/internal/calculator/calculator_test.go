package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		{"add integers", Add, []float64{2, 3}, 5, nil},
		{"add negatives", Add, []float64{-2.5, -0.5}, -3, nil},
		{"subtract", Subtract, []float64{10, 4}, 6, nil},
		{"subtract to negative", Subtract, []float64{4, 10}, -6, nil},
		{"multiply", Multiply, []float64{6, 7}, 42, nil},
		{"multiply by zero is +0", Multiply, []float64{-1, 0}, 0, nil},
		{"divide", Divide, []float64{9, 3}, 3, nil},
		{"divide fractional", Divide, []float64{1, 4}, 0.25, nil},
		{"divide by zero", Divide, []float64{1, 0}, 0, ErrDivisionByZero},
		{"zero divided by zero", Divide, []float64{0, 0}, 0, ErrDivisionByZero},
		{"power", Power, []float64{2, 10}, 1024, nil},
		{"power negative exponent", Power, []float64{2, -2}, 0.25, nil},
		{"power fractional exponent", Power, []float64{9, 0.5}, 3, nil},
		{"negative base with fractional exponent", Power, []float64{-8, 0.5}, 0, ErrUndefinedResult},
		{"power overflow", Power, []float64{10, 400}, 0, ErrOutOfRange},
		{"zero to negative power", Power, []float64{0, -1}, 0, ErrOutOfRange},
		{"sqrt", Sqrt, []float64{16}, 4, nil},
		{"sqrt zero", Sqrt, []float64{0}, 0, nil},
		{"sqrt negative", Sqrt, []float64{-4}, 0, ErrNegativeSqrt},
		{"percentage", Percentage, []float64{10, 200}, 20, nil},
		{"percentage of one", Percentage, []float64{25, 1}, 0.25, nil},
		{"multiply overflow", Multiply, []float64{math.MaxFloat64, 2}, 0, ErrOutOfRange},
		{"unsupported operation", Operation("modulo"), []float64{1, 2}, 0, ErrUnsupportedOperation},
		{"too few operands", Add, []float64{1}, 0, ErrInvalidOperands},
		{"too many operands", Sqrt, []float64{1, 2}, 0, ErrInvalidOperands},
		{"NaN operand", Add, []float64{math.NaN(), 1}, 0, ErrInvalidOperands},
		{"Inf operand", Add, []float64{math.Inf(1), 1}, 0, ErrInvalidOperands},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands...)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if math.Abs(got-tt.want) > 1e-12 {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
			if got == 0 && math.Signbit(got) {
				t.Fatal("got negative zero")
			}
		})
	}
}

func TestLookup(t *testing.T) {
	info, err := Lookup(Sqrt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Arity != 1 {
		t.Fatalf("sqrt arity = %d, want 1", info.Arity)
	}
	if _, err := Lookup("nope"); !errors.Is(err, ErrUnsupportedOperation) {
		t.Fatalf("error = %v, want ErrUnsupportedOperation", err)
	}
}

func TestOperationsIsCompleteAndSorted(t *testing.T) {
	ops := Operations()
	if len(ops) != len(registry) {
		t.Fatalf("got %d operations, want %d", len(ops), len(registry))
	}
	for i := 1; i < len(ops); i++ {
		if ops[i-1].Name >= ops[i].Name {
			t.Fatalf("operations not sorted: %q before %q", ops[i-1].Name, ops[i].Name)
		}
	}
}
