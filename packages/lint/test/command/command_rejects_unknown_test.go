package main

import (
	"strings"
	"testing"
)

// TestCommandRejectsUnknown verifies the lint sidecar rejects unknown subcommands.
//
// Unknown command handling belongs to the wrapper, not to tsgo project loading.
// The sidecar should fail before it attempts to parse flags or read compiler
// configuration.
//
// This scenario protects the native host protocol. Unsupported command names
// must produce a wrapper-level diagnostic and a command-error status.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the run front door's stdout and stderr streams.
// 3. Assert the unknown-command diagnostic and command-error status.
func TestCommandRejectsUnknown(t *testing.T) {
	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{"wat"})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
		t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
