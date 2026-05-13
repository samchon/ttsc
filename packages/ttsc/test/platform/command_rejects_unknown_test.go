package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies unsupported platform commands fail clearly.
//
// Unknown commands must stop in the platform helper wrapper. Falling through to
// compiler behavior would blur the package boundary and make this binary look
// like the full JavaScript ttsc command.
//
// This scenario covers the default dispatch branch. The error text includes the
// unsupported command and points callers back to the JavaScript CLI help path.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert command-error status and the unknown-command diagnostic.
func TestCommandRejectsUnknown(t *testing.T) {
  code, stdout, stderr := runPlatformCommand(t, "compile")
  if code != 2 || stdout != "" ||
    !strings.Contains(stderr, `unknown command "compile"`) ||
    !strings.Contains(stderr, `run "ttsc --help" through the JavaScript CLI`) {
    t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
