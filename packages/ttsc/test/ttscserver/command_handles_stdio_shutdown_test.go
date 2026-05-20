package ttscserver_test

import (
  "testing"
)

// TestTtscserverCommandHandlesStdioShutdown verifies the LSP host shuts down
// cleanly when the editor closes its end of stdin.
//
// EOF on stdin is the normal editor-driven shutdown signal. The host must
// return exit 0 through the runLSPServer happy path rather than treating the
// closed pipe as a crash and producing a non-zero exit code.
//
// 1. Run ttscserver --stdio with stdin closed immediately (empty payload).
// 2. Assert exit code 0.
func TestTtscserverCommandHandlesStdioShutdown(t *testing.T) {
  code, _, errOut := runTtscserverWithStdin(t, "", "--stdio", "--cwd", t.TempDir())
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
