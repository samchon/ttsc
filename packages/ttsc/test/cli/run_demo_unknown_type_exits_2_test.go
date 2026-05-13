package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunDemoUnknownTypeExits2 verifies unsupported demo type names fail as
// command errors.
//
// The demo command should reject unknown atoms before it prints synthetic
// JavaScript. This keeps package smoke output honest and distinguishes flag
// parsing from semantic type selection.
//
// This scenario exercises the unsupported-type branch through the native
// command process. The assertion checks the public diagnostic rather than the
// internal helper implementation.
//
// 1. Run the demo command with an unsupported type.
// 2. Capture stdout and stderr from the command process.
// 3. Assert status 2 and the unknown-type diagnostic.
func TestCLIRunDemoUnknownTypeExits2(t *testing.T) {
  code, stdout, stderr := runNativeCommand(t, "demo", "--type=object")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown --type") {
    t.Fatalf("demo unknown type mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
