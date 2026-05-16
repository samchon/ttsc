package linthost

import (
  "strings"
  "testing"
)

// TestCommandFormatRejectsEmitFlag verifies the format command refuses --emit.
//
// `ttsc format` is contract-bound to keep emit disabled — the host launcher
// already guarantees this, but the sidecar must still fail loudly when a
// caller bypasses the launcher and passes `--emit` directly. The refusal
// keeps the format subcommand strictly write-only for source files.
//
// 1. Run the lint sidecar's format command with --emit attached.
// 2. Capture stdout/stderr/status.
// 3. Assert exit code 2 with the documented refusal message on stderr.
func TestCommandFormatRejectsEmitFlag(t *testing.T) {
  root := seedLintProject(t, "const value = 1;\nJSON.stringify(value);\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--emit",
      "--cwd", root,
      "--plugins-json", lintManifest(t, map[string]string{}),
    })
  })
  if code != 2 {
    t.Fatalf("expected exit code 2, got code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stderr, "@ttsc/lint format: --emit is not supported") {
    t.Fatalf("expected refusal message on stderr, got %q", stderr)
  }
}
