package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandDemoEmitsRequestedType verifies the demo command emits a predicate.
//
// The platform helper's demo command is a tiny native smoke path. It should
// parse its flags, select the requested atomic type, and print deterministic
// JavaScript without loading a real project.
//
// This scenario covers the successful demo dispatch branch through runDemo. A
// number predicate is enough to prove parsed flags flow into demoArrow and then
// back to the command writer.
//
// 1. Invoke the demo command with an explicit numeric type.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert successful status and the emitted number predicate.
func TestCommandDemoEmitsRequestedType(t *testing.T) {
  code, stdout, stderr := runPlatformCommand(t, "demo", "--type=number")
  if code != 0 || stderr != "" ||
    !strings.Contains(stdout, "// demo<number>") ||
    !strings.Contains(stdout, `"number" === typeof input`) {
    t.Fatalf("demo success mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
