// Command server runs the calculator REST API.
//
// Configuration (environment variables):
//
//	PORT             port to listen on (default 8080)
//	ALLOWED_ORIGINS  comma-separated CORS origins, "*" for any (default: CORS off)
//	STATIC_DIR       directory of the built frontend to serve (default: none)
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/bahadirkarsli/sezzle-calculator/backend/internal/api"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, logger, os.Getenv); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

// run starts the server and blocks until ctx is cancelled or the listener fails.
func run(ctx context.Context, logger *slog.Logger, getenv func(string) string) error {
	port := getenv("PORT")
	if port == "" {
		port = "8080"
	}
	handler := api.NewHandler(api.Config{
		AllowedOrigins: splitList(getenv("ALLOWED_ORIGINS")),
		StaticDir:      getenv("STATIC_DIR"),
		Logger:         logger,
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
