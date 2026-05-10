package main

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
func TestCommandRejectsConflictingEmitFlags(t *testing.T) {
	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{"check", "--emit", "--noEmit"})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "mutually exclusive") {
		t.Fatalf("flag conflict mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
