package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverCommandDefaultPrintsHelp verifies ttscserver prints help when
// invoked with no arguments.
//
// Editors occasionally probe a newly installed binary by running it bare.
// ttscserver must print the help banner and exit cleanly instead of blocking
// stdin waiting for LSP traffic that will never arrive.
//
// 1. Run ttscserver with no arguments.
// 2. Assert exit 0 and that stdout contains the LSP host banner.
func TestTtscserverCommandDefaultPrintsHelp(t *testing.T) {
  code, out, errOut := runTtscserver(t)
  if code != 0 {
    t.Fatalf("zero-arg run failed: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(out, "Language Server Protocol host") {
    t.Fatalf("help banner missing:\n%s", out)
  }
}
