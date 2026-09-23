package main

import (
	"context"
	"io"
	"log/slog"
	"reflect"
	"testing"
	"time"
)

func env(vars map[string]string) func(string) string {
	return func(k string) string { return vars[k] }
}

func TestRunShutsDownGracefully(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- run(ctx, slog.New(slog.NewTextHandler(io.Discard, nil)), env(map[string]string{"PORT": "0"}))
	}()

	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run returned %v, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestRunReportsListenErrors(t *testing.T) {
	err := run(context.Background(), slog.New(slog.NewTextHandler(io.Discard, nil)),
		env(map[string]string{"PORT": "not-a-port"}))
	if err == nil {
		t.Fatal("expected an error for an invalid port")
	}
}

func TestSplitList(t *testing.T) {
	got := splitList(" http://a.test, ,http://b.test ,")
	want := []string{"http://a.test", "http://b.test"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	if splitList("") != nil {
		t.Fatal("empty input should yield nil")
	}
}
