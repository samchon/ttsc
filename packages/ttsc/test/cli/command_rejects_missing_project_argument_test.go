package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandRejectsMissingProjectArgument verifies project aliases require
// an explicit config path.
//
// The `-p` and `--project` aliases are parsed by the top-level command switch,
// not by the build flag set. Missing values should therefore produce the
// command's own concise diagnostic.
//
// 1. Execute each project alias without a following path.
// 2. Assert each invocation exits with code 2.
// 3. Assert stderr tells the user that a path argument is required.
func TestCLICommandRejectsMissingProjectArgument(t *testing.T) {
  for _, flag := range []string{"-p", "--project"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runNativeCommand(t, flag)
      if code != 2 {
        t.Fatalf("%s without path should fail: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      if !strings.Contains(errOut, "requires a path argument") {
        t.Fatalf("%s diagnostic missing required-path text: %q", flag, errOut)
      }
    })
  }
}
