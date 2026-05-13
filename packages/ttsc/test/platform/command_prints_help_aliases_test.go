package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsHelpAliases verifies explicit help commands share usage output.
//
// The helper exposes help aliases so users and package smoke scripts can ask
// for metadata without depending on the JavaScript launcher. Each alias must
// return before any compiler command is considered.
//
// This scenario protects the switch branch that handles -h, --help, and help.
// The assertions focus on the helper-specific usage text because compiler
// guidance belongs to the JavaScript ttsc and ttsx commands.
//
// 1. Invoke each documented help alias through run.
// 2. Capture stdout and stderr for every alias.
// 3. Assert successful status and the demo usage line.
func TestCommandPrintsHelpAliases(t *testing.T) {
  for _, argument := range []string{"-h", "--help", "help"} {
    code, stdout, stderr := runPlatformCommand(t, argument)
    if code != 0 || stderr != "" || !strings.Contains(stdout, "ttsc demo --type=string") {
      t.Fatalf("help alias %q mismatch: code=%d stdout=%q stderr=%q", argument, code, stdout, stderr)
    }
  }
}
