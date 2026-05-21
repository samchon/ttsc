package linthost

import (
  "strings"
  "testing"
)

// TestCommandFixRejectsEmitFlag verifies fix refuses --emit before doing work.
//
// `ttsc fix` keeps emit disabled by contract — the host launcher already
// guarantees this, but the sidecar must still fail loudly when a caller
// bypasses the launcher and passes `--emit` directly. Otherwise fix could
// silently emit JavaScript alongside the rewritten sources.
//
// 1. Run the lint sidecar's fix command with --emit attached.
// 2. Capture stdout/stderr/status.
// 3. Assert exit code 2 with the documented refusal message on stderr.
func TestCommandFixRejectsEmitFlag(t *testing.T) {
  root := seedLintProject(t, "const value = 1;\nJSON.stringify(value);\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--emit",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 {
    t.Fatalf("expected exit code 2, got code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stderr, "@ttsc/lint fix: --emit is not supported") {
    t.Fatalf("expected refusal message on stderr, got %q", stderr)
  }
}
