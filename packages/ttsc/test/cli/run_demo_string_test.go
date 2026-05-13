package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunDemoString verifies the demo command emits the default string
// predicate.
//
// The demo command is the native backend smoke path exposed by the compiler
// binary. A string request should produce deterministic JavaScript and include
// a typed comment prefix for easy package-install diagnostics.
//
// This scenario keeps the string branch separate from the general help/version
// smoke test. It protects both the selected predicate and the printed demo tag.
//
// 1. Run the native demo command with --type=string.
// 2. Capture stdout and stderr from the command process.
// 3. Assert successful status and string predicate output.
func TestCLIRunDemoString(t *testing.T) {
  code, stdout, stderr := runNativeCommand(t, "demo", "--type=string")
  want := `(input) => "string" === typeof input`
  if code != 0 || stderr != "" || !strings.Contains(stdout, want) || !strings.Contains(stdout, "demo<string>") {
    t.Fatalf("demo string mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
