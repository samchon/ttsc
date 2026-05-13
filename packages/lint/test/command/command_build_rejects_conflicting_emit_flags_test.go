package main

import (
  "strings"
  "testing"
)

// TestCommandBuildRejectsConflictingEmitFlags verifies build validates emit conflicts.
//
// The check command already covers the shared parse error, but build is the
// command where emit flags are most likely to be combined by callers. It should
// reject --emit and --noEmit before loading tsconfig or writing output.
//
// This scenario drives the public command front door to keep stderr and exit
// status aligned with the check command behavior.
//
// 1. Invoke build with both emit-control flags.
// 2. Capture stdout and stderr from the command front door.
// 3. Assert the mutual-exclusion diagnostic and command-error status.
func TestCommandBuildRejectsConflictingEmitFlags(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"build", "--emit", "--noEmit"})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "mutually exclusive") {
    t.Fatalf("build flag conflict mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
