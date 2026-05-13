package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIRunVersion verifies version aliases report native build metadata.
//
// Version output is a project-free diagnostic path. It needs to identify both
// the ttsc wrapper and the Go runtime so install smoke checks can tell which
// binary they are exercising.
//
// This scenario covers the -v, --version, and version dispatch branches. The
// assertion avoids exact release values because local builds use default
// ldflags while packaged builds replace them.
//
// 1. Run every documented version alias.
// 2. Capture the command stdout and stderr streams.
// 3. Assert exit status zero and the expected metadata fragments.
func TestCLIRunVersion(t *testing.T) {
  for _, flag := range []string{"-v", "--version", "version"} {
    code, stdout, stderr := runNativeCommand(t, flag)
    if code != 0 ||
      !strings.Contains(stdout, "ttsc ") ||
      !strings.Contains(stdout, "commit") ||
      !strings.Contains(stdout, "go") {
      t.Fatalf("version alias %q mismatch: code=%d stdout=%q stderr=%q", flag, code, stdout, stderr)
    }
  }
}
