package paths_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsFlagShapedCommand rejects paths flag-shaped commands.
//
// The paths wrapper sees the first argv entry before alias rewriting or utility flag parsing
// begins. A malformed host invocation that starts with an option must stay a wrapper-level usage
// error.
//
// This separates command dispatch from project diagnostics. The scenario is intentionally free of
// tsconfig and plugin JSON so the malformed command cannot be hidden by compiler setup.
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
