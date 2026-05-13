package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsVersion verifies the platform helper reports build metadata.
//
// Version output is the only metadata path owned by the platform package. It
// must stay project-free so package installation checks can identify the helper
// binary even when no TypeScript project exists.
//
// This scenario covers the version dispatch branch and its alias forms. The
// assertion checks helper branding, commit metadata, and Go runtime metadata
// without depending on a release build's ldflags.
//
// 1. Invoke each documented version alias through run.
// 2. Capture stdout and stderr for every alias.
// 3. Assert successful status and version metadata text.
func TestCommandPrintsVersion(t *testing.T) {
  for _, argument := range []string{"-v", "--version", "version"} {
    code, stdout, stderr := runPlatformCommand(t, argument)
    if code != 0 || stderr != "" ||
      !strings.Contains(stdout, "ttsc platform helper") ||
      !strings.Contains(stdout, "commit") ||
      !strings.Contains(stdout, "go ") {
      t.Fatalf("version alias %q mismatch: code=%d stdout=%q stderr=%q", argument, code, stdout, stderr)
    }
  }
}
