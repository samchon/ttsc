package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandRejectsMissingStdio verifies the transport guard
// rejects any invocation that omits --stdio.
//
// The native host only speaks stdio. Running without the flag must produce
// a clean exit 2 with an actionable error instead of hanging indefinitely on
// a pipe that the caller never set up.
//
// 1. Run ttscserver with a flag but without --stdio.
// 2. Assert exit code 2 and a message that names the --stdio transport.
func TestTtscserverCommandRejectsMissingStdio(t *testing.T) {
  code, _, errOut := runTtscserver(t, "--cwd", t.TempDir())
  if code != 2 {
    t.Fatalf("expected exit 2 without --stdio, got %d (stderr=%q)", code, errOut)
  }
  if !strings.Contains(errOut, "--stdio") {
    t.Fatalf("error message missing --stdio mention:\n%s", errOut)
  }
}
