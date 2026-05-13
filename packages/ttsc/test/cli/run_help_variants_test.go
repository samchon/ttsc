package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunHelpVariants verifies help aliases print the same command surface.
//
// Help is a project-free path owned by the native command wrapper. Each alias
// must return before project discovery so users can inspect available commands
// even when a tsconfig is missing or broken.
//
// This scenario protects the -h, --help, and help dispatch branches through the
// real command binary. The assertion checks for the demo subcommand because it
// distinguishes ttsc help from generic Go flag usage.
//
// 1. Run every documented help alias.
// 2. Capture the command stdout and stderr streams.
// 3. Assert exit status zero and help text that lists demo.
func TestCLIRunHelpVariants(t *testing.T) {
  for _, flag := range []string{"-h", "--help", "help"} {
    code, stdout, stderr := runNativeCommand(t, flag)
    if code != 0 || !strings.Contains(stdout, "demo") {
      t.Fatalf("help alias %q mismatch: code=%d stdout=%q stderr=%q", flag, code, stdout, stderr)
    }
  }
}
