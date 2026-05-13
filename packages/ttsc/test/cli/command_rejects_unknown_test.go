package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandRejectsUnknown verifies unsupported command words fail before
// project loading.
//
// Unknown non-flag, non-file-shaped arguments should not fall through into the
// project build lane. They are rejected by the top-level command switch with a
// help pointer.
//
// 1. Execute the native command with an unsupported subcommand name.
// 2. Assert the command exits with code 2.
// 3. Assert stderr identifies the unknown command and mentions help.
func TestCLICommandRejectsUnknown(t *testing.T) {
  code, out, errOut := runNativeCommand(t, "fly-to-mars")
  if code != 2 {
    t.Fatalf("unknown command should fail: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(errOut, "unknown command") || !strings.Contains(errOut, "--help") {
    t.Fatalf("unknown command diagnostic missing expected text: %q", errOut)
  }
}
