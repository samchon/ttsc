package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandDefaultPrintsHelp pins the zero-arg behavior. Editors
// occasionally probe a binary by running it with no flags; ttscserver must
// print the help banner instead of starting an unattended LSP session.
//
// 1. Run ttscserver with no arguments.
// 2. Assert exit 0 and the help banner.
func TestTtscserverCommandDefaultPrintsHelp(t *testing.T) {
  code, out, errOut := runTtscserver(t)
  if code != 0 {
    t.Fatalf("zero-arg run failed: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(out, "Language Server Protocol host") {
    t.Fatalf("help banner missing:\n%s", out)
  }
}
