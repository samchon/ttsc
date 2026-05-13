package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandVersionAliases verifies every version spelling reports native
// build metadata.
//
// Version output is handled before project loading and should stay available in
// empty directories. The banner also carries Go runtime metadata used when
// diagnosing native binary mismatches.
//
// 1. Execute `-v`, `--version`, and `version`.
// 2. Assert every alias exits successfully.
// 3. Assert the banner includes the ttsc name, commit field, and Go runtime.
func TestCLICommandVersionAliases(t *testing.T) {
  for _, flag := range []string{"-v", "--version", "version"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runNativeCommand(t, flag)
      if code != 0 {
        t.Fatalf("%s version alias failed: code=%d stdout=%q stderr=%q", flag, code, out, errOut)
      }
      for _, expected := range []string{"ttsc ", "commit", "go "} {
        if !strings.Contains(out, expected) {
          t.Fatalf("%s version output missing %q:\n%s", flag, expected, out)
        }
      }
    })
  }
}
