package linthost

import (
  "strings"
  "testing"
)

// TestCommandRejectsConflictingEmitFlags verifies mutually exclusive emit flags.
//
// The project commands accept host-forwarded flags, but --emit and --noEmit
// cannot both describe the same run. This validation must happen during flag
// parsing before any tsconfig work starts.
//
// This scenario covers the shared parseSubcommandFlags branch used by check and
// build. The error text is part of the command contract because callers need to
// distinguish usage failures from TypeScript diagnostics.
//
// 1. Invoke check with both --emit and --noEmit.
// 2. Capture the command-frontdoor stderr output.
// 3. Assert the command-error status and mutual-exclusion diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification run check with both emit and noEmit returns status2, empty stdout and a mutual-exclusion diagnostic.
// @evidence contracts/testing.md#independent-expectations Two opposed emit policies cannot describe one command; independently authored conflicting flags establish rejection without a project configuration.
// @evidence contracts/testing.md#distinguishing-cases Owns the shared check-command conflict path; build has its own front-door variant and ordinary forwarded options are checked separately.
// @evidence contracts/testing.md#execution-ownership TestCommandRejectsConflictingEmitFlags is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
func TestCommandRejectsConflictingEmitFlags(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--emit", "--noEmit"})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "mutually exclusive") {
    t.Fatalf("flag conflict mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
