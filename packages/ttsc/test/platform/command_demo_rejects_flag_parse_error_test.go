package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandDemoRejectsFlagParseError verifies malformed demo flags fail early.
//
// Flag parsing belongs to runDemo before any predicate selection happens. A
// malformed --type option should return the command-error status from the flag
// package and should not print demo JavaScript.
//
// This scenario covers the ContinueOnError branch from the demo flag set. It
// proves parser diagnostics are wired to the helper stderr writer rather than
// silently falling back to the default string predicate.
//
// 1. Invoke demo with --type but without the required value.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert command-error status and the flag parser diagnostic.
func TestCommandDemoRejectsFlagParseError(t *testing.T) {
  code, stdout, stderr := runPlatformCommand(t, "demo", "--type")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "flag needs an argument") {
    t.Fatalf("demo flag parse mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
