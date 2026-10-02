package linthost

import (
  "strings"
  "testing"
)

// TestCommandFormatRejectsEmitFlag verifies the format command refuses --emit.
//
// `ttsc format` is contract-bound to keep emit disabled. The host launcher
// already guarantees this, but the sidecar must still fail loudly when a
// caller bypasses the launcher and passes `--emit` directly. The refusal
// keeps the format subcommand strictly write-only for source files.
//
// 1. Run the lint sidecar's format command with --emit attached.
// 2. Capture stdout/stderr/status.
// 3. Assert exit code 2 with the documented refusal message on stderr.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command with `--emit` on a valid project and asserts exit code 2 and a stderr containing `@ttsc/lint format: --emit is not supported`.
// @evidence contracts/testing.md#independent-expectations The status 2 and the refusal substring are literals from the stated contract that format is write-only and refuses emit; they do not come from the dispatcher's own computation.
// @evidence contracts/testing.md#distinguishing-cases One negative case (emit flag refused). The same project without `--emit` is not run here, so acceptance is not contrasted, and file contents are not checked after the refusal.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand against a temp-dir project; no child process, built binary or installed consumer.
func TestCommandFormatRejectsEmitFlag(t *testing.T) {
  root := seedLintProject(t, "const value = 1;\nJSON.stringify(value);\n")
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--emit",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 {
    t.Fatalf("expected exit code 2, got code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !strings.Contains(stderr, "@ttsc/lint format: --emit is not supported") {
    t.Fatalf("expected refusal message on stderr, got %q", stderr)
  }
}
