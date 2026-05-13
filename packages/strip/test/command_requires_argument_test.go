package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRequiresArgument verifies the strip sidecar rejects an empty command line.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Missing command handling must stop before any project or strip pattern is inspected. That
// gives the host a stable usage failure instead of a misleading transform diagnostic.
//
// 1. Run the real plugin binary with no subcommand.
// 2. Capture stdout, stderr, and the wrapped exit status.
// 3. Assert the required-command diagnostic and command-error status.
func TestCommandRequiresArgument(t *testing.T) {
  // Command assertion: this prevents an empty argv from falling through to
  // project loading or manifest parsing.
  code, stdout, stderr := runPlugin(t)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
