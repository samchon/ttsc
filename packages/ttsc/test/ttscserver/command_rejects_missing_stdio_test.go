package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandRejectsMissingStdio pins the transport guard. The
// native host only speaks stdio today; running without the flag must produce
// a clean exit 2 with an actionable message instead of hanging on an unused
// pipe transport.
//
// 1. Run ttscserver with a flag but without --stdio.
// 2. Assert exit code 2 and a message mentioning the supported transport.
func TestTtscserverCommandRejectsMissingStdio(t *testing.T) {
  code, _, errOut := runTtscserver(t, "--cwd", t.TempDir())
  if code != 2 {
    t.Fatalf("expected exit 2 without --stdio, got %d (stderr=%q)", code, errOut)
  }
  if !strings.Contains(errOut, "--stdio") {
    t.Fatalf("error message missing --stdio mention:\n%s", errOut)
  }
}
