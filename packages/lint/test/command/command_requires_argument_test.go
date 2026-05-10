package main

import (
	"strings"
	"testing"
)

// TestCommandRequiresArgument verifies the lint sidecar rejects an empty command line.
//
// The lint binary is a host-facing command wrapper, so missing command handling
// must fail before project loading, tsconfig parsing, or rule setup begins.
//
// This scenario protects the sidecar protocol error path. A host that spawns
// the binary without a subcommand should receive a stable usage diagnostic and
// the command-error status.
//
// 1. Invoke the command front door with no arguments.
// 2. Capture the real process streams written by run.
// 3. Assert the command-error status and required-command diagnostic.
func TestCommandRequiresArgument(t *testing.T) {
	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run(nil)
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
		t.Fatalf("empty command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
