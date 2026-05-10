package paths_test

import (
	"strings"
	"testing"
)

// TestCommandRequiresArgument verifies the paths sidecar rejects an empty command line.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// The wrapper must report missing commands before resolving tsconfig paths. This protects the
// sidecar protocol from accidentally treating an invalid host call as a project diagnostic.
//
// 1. Run the real plugin binary without a subcommand.
// 2. Capture the wrapped go run status and stderr.
// 3. Assert the command-error status and required-command message.
func TestCommandRequiresArgument(t *testing.T) {
	// Command assertion: this is the guard that catches host-side invocation
	// mistakes before project loading begins.
	code, stdout, stderr := runPlugin(t)
	if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
		t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
