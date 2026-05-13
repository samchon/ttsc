package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandHelpAliases verifies every help spelling stays project-free.
//
// Help is handled by the top-level command switch before project loading. The
// aliases should therefore succeed even when no fixture project has been
// created.
//
// 1. Execute `-h`, `--help`, and `help`.
// 2. Assert every alias exits successfully.
// 3. Assert the output includes the project-build and demo command sections.
func TestCLICommandHelpAliases(t *testing.T) {
  for _, flag := range []string{"-h", "--help", "help"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runNativeCommand(t, flag)
      if code != 0 {
        t.Fatalf("%s help alias failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      if !strings.Contains(out, "Project build:") || !strings.Contains(out, "demo") {
        t.Fatalf("%s help output missing expected sections:\n%s", flag, out)
      }
    })
  }
}
