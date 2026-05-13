package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the strip sidecar rejects unknown subcommands.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Unknown-command handling is part of the wrapper protocol. The scenario ensures unsupported
// host input never reaches the stripping engine or project compiler path.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the wrapper-level diagnostic.
// 3. Assert the command-error status and unknown-command message.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: the sidecar intentionally accepts only check,
  // transform, build, and version.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
