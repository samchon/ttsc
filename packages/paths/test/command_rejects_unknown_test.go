package paths_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the paths sidecar rejects unknown subcommands.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Unknown-command handling belongs to the package wrapper, not the compiler host. The scenario
// ensures invalid protocol input fails before alias rewriting or project loading begins.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Observe the wrapper-level stderr text.
// 3. Assert the command-error status and unknown-command diagnostic.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: output-stage sidecars are not supported for this
  // package; only check, transform, build, and version are valid.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
