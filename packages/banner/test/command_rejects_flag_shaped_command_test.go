package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsFlagShapedCommand rejects banner flag-shaped commands.
//
// The banner wrapper sees the first argv entry before the shared utility host can parse command
// flags. A malformed host invocation that starts with an option must therefore fail as an unknown
// command instead of reaching project compilation.
//
// This keeps wrapper-level protocol errors distinct from build, transform, and check flag
// parsing. The command is shaped like a flag to cover the path where a caller forgets the
// subcommand entirely.
//
// 1. Invoke the real wrapper with a flag-shaped first argument.
// 2. Capture stdout, stderr, and the wrapped process status.
// 3. Assert the wrapper reports an unknown command with command-error status.
func TestCommandRejectsFlagShapedCommand(t *testing.T) {
  // Command assertion: the wrapper should reject the malformed command before
  // delegating to utility flag parsing.
  code, stdout, stderr := runPlugin(t, "--bogus")
  if code != 2 || stdout != "" || !strings.Contains(stderr, `unknown command "--bogus"`) {
    t.Fatalf("flag-shaped command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
