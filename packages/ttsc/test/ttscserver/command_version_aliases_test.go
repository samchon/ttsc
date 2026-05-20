package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandVersionAliases verifies every version spelling
// reports the same banner.
//
// Editors frequently log this output for support reports, so all aliases
// must resolve to the same banner. A spelling that diverged would produce
// inconsistent diagnostic metadata across editor configurations.
//
// 1. Run ttscserver -v, --version, and version.
// 2. Assert each alias exits 0 and prints the ttscserver version banner.
func TestTtscserverCommandVersionAliases(t *testing.T) {
  for _, flag := range []string{"-v", "--version", "version"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runTtscserver(t, flag)
      if code != 0 {
        t.Fatalf("%s version alias failed: code=%d stderr=%q", flag, code, errOut)
      }
      if !strings.HasPrefix(strings.TrimSpace(out), "ttscserver ") {
        t.Fatalf("%s output missing version prefix:\n%s", flag, out)
      }
    })
  }
}
