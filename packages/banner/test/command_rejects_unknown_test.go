package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the banner sidecar rejects unknown subcommands.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Unknown command handling protects the sidecar protocol between ttsc and the package binary.
// The command should fail early with a wrapper-level diagnostic instead of falling through to
// project compilation.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the sidecar exit status and stderr.
// 3. Assert the command-error status and unknown-command diagnostic.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: `output` used to be a tempting stage name, but this
  // native sidecar only accepts check, transform, build, and version.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
