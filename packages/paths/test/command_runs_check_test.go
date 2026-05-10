package paths_test

import (
	"os"
	"path/filepath"
	"testing"
)

// TestCommandRunsCheck verifies the paths sidecar can run a no-emit project check.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// The check branch should validate a project that uses path aliases without writing rewritten
// JavaScript. That separates diagnostic-only host execution from transform and build output
// contracts.
//
// 1. Materialize a project with baseUrl and paths aliases.
// 2. Run check through the package command wrapper.
// 3. Assert success and verify no output directory was written.
func TestCommandRunsCheck(t *testing.T) {
	// Scenario setup: the shared fixture includes an alias import and target so
	// program loading sees the same configuration used by build mode.
	root := seedPathsProject(t)
	// Check assertion: paths has no diagnostics in a valid project, and --quiet
	// should keep the command-frontdoor output empty.
	code, stdout, stderr := runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
	if code != 0 || stdout != "" || stderr != "" {
		t.Fatalf("check branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	if _, err := os.Stat(filepath.Join(root, "dist")); !os.IsNotExist(err) {
		t.Fatalf("check branch wrote output directory: %v", err)
	}
}
