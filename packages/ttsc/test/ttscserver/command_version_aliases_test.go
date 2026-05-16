package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandVersionAliases verifies the version banners. Editors
// frequently log this string for support reports, so every spelling must
// resolve to the same line.
//
// 1. Run ttscserver -v, --version, version.
// 2. Assert each alias exits 0 and prints a "ttscserver <ver>" banner.
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
