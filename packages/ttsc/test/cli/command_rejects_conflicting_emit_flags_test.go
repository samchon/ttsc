package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandRejectsConflictingEmitFlags verifies build mode rejects
// contradictory emit controls before project loading.
//
// The `--emit` and `--noEmit` flags are mutually exclusive command intent.
// This branch is checked before cwd resolution and tsconfig parsing, so the
// test does not need a project fixture.
//
// 1. Execute `build` with both emit flags.
// 2. Assert the command returns the command-usage exit code.
// 3. Assert stderr describes the mutual exclusion.
func TestCLICommandRejectsConflictingEmitFlags(t *testing.T) {
  code, out, errOut := runNativeCommand(t, "build", "--emit", "--noEmit")
  if code != 2 {
    t.Fatalf("conflicting emit flags should fail: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(errOut, "mutually exclusive") {
    t.Fatalf("conflicting emit diagnostic missing mutual-exclusion text: %q", errOut)
  }
}
