package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandHelpAliases verifies every help spelling reaches the
// same banner.
//
// Help is dispatched before any LSP wiring, so the aliases must succeed
// independently of the project layout. An alias that diverged from the main
// help path would show the wrong usage text to users of that spelling.
//
// 1. Run ttscserver -h, --help, and help.
// 2. Assert each alias exits cleanly with the LSP host usage banner.
func TestTtscserverCommandHelpAliases(t *testing.T) {
  for _, flag := range []string{"-h", "--help", "help"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := runTtscserver(t, flag)
      if code != 0 {
        t.Fatalf("%s help alias failed: code=%d stderr=%q", flag, code, errOut)
      }
      if !strings.Contains(out, "ttscserver --stdio") {
        t.Fatalf("%s output missing usage line:\n%s", flag, out)
      }
    })
  }
}
