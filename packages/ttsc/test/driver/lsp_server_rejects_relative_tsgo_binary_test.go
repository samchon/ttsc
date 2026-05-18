package driver_test

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsRelativeTsgoBinary verifies the upstream binary contract
// requires an absolute path.
//
// ttscserver should run the project-selected TypeScript-Go binary, not whatever
// happens to appear first on PATH. Keeping this validation in the native host
// protects callers that bypass the JavaScript launcher.
//
// 1. Call RunLSPServer with TsgoBinary="tsgo".
// 2. Close editor input immediately so the proxy side can drain.
// 3. Assert the absolute-path validation error is surfaced.
func TestLSPServerRejectsRelativeTsgoBinary(t *testing.T) {
	err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
		In:         strings.NewReader(""),
		Out:        io.Discard,
		Err:        io.Discard,
		Cwd:        t.TempDir(),
		TsgoBinary: "tsgo",
	})
	if err == nil || !strings.Contains(err.Error(), "must be absolute") {
		t.Fatalf("expected absolute-path error, got %v", err)
	}
}
