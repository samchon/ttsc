package driver_test

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerPrefersRunnerError pins the contract that the upstream
// tsgo server error wins over the proxy error in the final fold. A
// future refactor that swapped the order (or replaced the slice with
// errors.Join without an Is-aware unwrap) would silently flip the
// reported root cause and editors would see the wrong message.
//
// 1. Substitute an upstream runner that returns a `runnerSentinel` error.
// 2. Force the proxy half to fail with a different sentinel.
// 3. Assert RunLSPServer returns the runner sentinel.
func TestLSPServerPrefersRunnerError(t *testing.T) {
	runnerSentinel := errors.New("synthetic upstream failure")
	restore := driver.WithUpstreamRunnerForTest(func(_ context.Context, _ io.Reader, _ io.Writer, _ driver.LSPServerOptions) error {
		return runnerSentinel
	})
	defer restore()

	// Editor pipes are set up so the proxy will fail too: closing the
	// editor reader before the proxy's pumpUpstreamToEditor writes
	// makes that write fail with io.ErrClosedPipe, distinct from the
	// runner sentinel.
	editorInR, editorInW := io.Pipe()
	editorOutR, editorOutW := io.Pipe()
	defer editorInR.Close()
	defer editorOutW.Close()
	editorOutR.Close()
	editorInW.Close()

	done := make(chan error, 1)
	go func() {
		done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
			In:  editorInR,
			Out: editorOutW,
			Err: io.Discard,
			Cwd: t.TempDir(),
		})
	}()

	select {
	case err := <-done:
		if !errors.Is(err, runnerSentinel) {
			t.Fatalf("expected runner sentinel to win, got %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("RunLSPServer did not return")
	}
}
