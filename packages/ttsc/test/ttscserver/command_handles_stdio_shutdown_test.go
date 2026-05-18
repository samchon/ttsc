package ttscserver_test

import (
	"testing"
)

// TestTtscserverCommandHandlesStdioShutdown verifies that when the editor
// closes its end of stdin, the LSP host shuts down cleanly with exit 0
// instead of treating EOF as a crash. This covers the runLSPServer happy
// path through the real upstream tsgo process.
//
// 1. Run ttscserver --stdio with an empty stdin (closed immediately).
// 2. Assert exit code 0.
func TestTtscserverCommandHandlesStdioShutdown(t *testing.T) {
	code, _, errOut := runTtscserverWithStdin(t, "", "--stdio", "--cwd", t.TempDir())
	if code != 0 {
		t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
	}
}
