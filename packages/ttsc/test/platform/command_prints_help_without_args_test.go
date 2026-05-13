package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsHelpWithoutArgs verifies the empty platform command prints usage.
//
// The per-platform helper is not the compiler front door. When a package smoke
// check starts it without arguments, the binary should explain the helper role
// instead of attempting project discovery or delegating to the JavaScript CLI.
//
// This scenario covers the no-args dispatch branch directly. It keeps the
// compatibility helper's default behavior stable for package managers that run
// installed binaries as a quick health check.
//
// 1. Invoke run with an empty argument slice.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert a successful status and platform helper usage text.
func TestCommandPrintsHelpWithoutArgs(t *testing.T) {
  code, stdout, stderr := runPlatformCommand(t)
  if code != 0 || stderr != "" || !strings.Contains(stdout, "ttsc platform helper.") {
    t.Fatalf("empty command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
