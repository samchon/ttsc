package ttscserver_test

import (
  "testing"
)

// TestTtscserverCommandRejectsUnknownFlag verifies the flag parser surfaces
// unknown arguments with exit 2 rather than silently ignoring them.
//
// Editors that scaffold the wrong flag for ttscserver should see the failure
// during development, not silent misbehavior in the field where a mistyped
// flag might mask a real configuration problem.
//
// 1. Run ttscserver with an unrecognized flag.
// 2. Assert exit code 2.
func TestTtscserverCommandRejectsUnknownFlag(t *testing.T) {
  code, _, _ := runTtscserver(t, "--garbage-flag")
  if code != 2 {
    t.Fatalf("expected exit 2 for unknown flag, got %d", code)
  }
}
