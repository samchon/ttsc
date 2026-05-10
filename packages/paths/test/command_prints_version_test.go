package paths_test

import (
	"strings"
	"testing"
)

// TestCommandPrintsVersion verifies the paths sidecar exposes its version command.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Version output is pure command metadata. It must stay available without a project directory,
// aliases, or plugin JSON so package discovery can run independently.
//
// 1. Invoke the version branch through the real wrapper.
// 2. Capture stdout and stderr without a project fixture.
// 3. Assert successful status and the @ttsc/paths banner text.
func TestCommandPrintsVersion(t *testing.T) {
	// Version assertion: this path is intentionally independent of tsconfig and
	// plugin manifest parsing.
	code, stdout, stderr := runPlugin(t, "version")
	if code != 0 || !strings.Contains(stdout, "@ttsc/paths 0.0.1") || stderr != "" {
		t.Fatalf("version branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
