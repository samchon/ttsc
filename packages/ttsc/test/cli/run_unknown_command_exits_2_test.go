package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunUnknownCommandExits2 verifies unknown command labels fail as usage
// errors.
//
// The native CLI accepts command labels, flags, project paths, and source-like
// build aliases. A label that is none of those must stop at the front door with
// a command error instead of falling into project compilation.
//
// This scenario covers the final default branch in command dispatch. The
// diagnostic text is enough to distinguish the branch from TypeScript project
// errors.
//
// 1. Run ttsc with an unsupported command label.
// 2. Capture stdout and stderr from the command process.
// 3. Assert status 2 and an unknown-command diagnostic.
func TestCLIRunUnknownCommandExits2(t *testing.T) {
  code, stdout, stderr := runNativeCommand(t, "fly-to-mars")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
