package paths_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsVersion verifies the paths sidecar exposes its version commands.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Version output is pure command metadata. It must stay available through the command name and
// both aliases without a project directory, path aliases, or plugin JSON so package discovery can
// run independently.
//
// 1. Invoke the version branch through the command name and both aliases.
// 2. Capture stdout and stderr without a project fixture.
// 3. Assert successful status and the @ttsc/paths banner text.
func TestCommandPrintsVersion(t *testing.T) {
  // Version assertion: these paths are intentionally independent of tsconfig
  // and plugin manifest parsing.
  for _, command := range []string{"version", "-v", "--version"} {
    code, stdout, stderr := runPlugin(t, command)
    if code != 0 || !strings.Contains(stdout, "@ttsc/paths 0.0.1") || stderr != "" {
      t.Fatalf("version branch mismatch for %s: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
