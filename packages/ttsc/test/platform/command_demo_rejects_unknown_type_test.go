package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandDemoRejectsUnknownType verifies demo reports unsupported atoms.
//
// The demo command intentionally models only a small set of atomic predicates.
// Unsupported type names should fail as command usage errors instead of
// emitting a misleading JavaScript predicate.
//
// This scenario covers the demoArrow error path as it is surfaced through the
// command front door. The diagnostic names the bad flag value and the supported
// set so callers can distinguish it from a flag parser failure.
//
// 1. Invoke demo with an unsupported --type value.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert command-error status and the unknown-type diagnostic.
func TestCommandDemoRejectsUnknownType(t *testing.T) {
  code, stdout, stderr := runPlatformCommand(t, "demo", "--type=symbol")
  if code != 2 || stdout != "" ||
    !strings.Contains(stderr, `unknown --type value "symbol"`) ||
    !strings.Contains(stderr, "string|number|boolean|bigint|any") {
    t.Fatalf("demo unknown type mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
