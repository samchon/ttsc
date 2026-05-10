package main

import (
	"strings"
	"testing"
)

// TestCommandPrintsVersion verifies the lint sidecar exposes command metadata.
//
// The version branch must not depend on a project fixture. Package discovery and
// smoke checks should be able to ask the native binary for its version even when
// no tsconfig is available.
//
// This scenario keeps version handling separate from compile paths. It proves
// the command wrapper can return metadata without touching the lint engine.
//
// 1. Invoke the version subcommand through the real run front door.
// 2. Capture stdout and stderr exactly as the host would.
// 3. Assert successful status and the @ttsc/lint version banner.
func TestCommandPrintsVersion(t *testing.T) {
	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{"version"})
	})
	if code != 0 || stderr != "" || !strings.Contains(stdout, "@ttsc/lint") {
		t.Fatalf("version mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
