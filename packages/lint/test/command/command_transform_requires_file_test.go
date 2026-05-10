package main

import (
	"strings"
	"testing"
)

// TestCommandTransformRequiresFile verifies transform rejects a missing source file.
//
// Transform is the single-file command branch, so --file is its required input.
// The command must fail during flag validation before project loading or rule
// parsing.
//
// This scenario protects the host protocol for transform callers. A missing
// file argument is a usage error, not a TypeScript diagnostic.
//
// 1. Invoke transform without --file.
// 2. Capture stderr from the command front door.
// 3. Assert the command-error status and required-file diagnostic.
func TestCommandTransformRequiresFile(t *testing.T) {
	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{"transform"})
	})
	if code != 2 || stdout != "" || !strings.Contains(stderr, "--file is required") {
		t.Fatalf("transform missing file mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
