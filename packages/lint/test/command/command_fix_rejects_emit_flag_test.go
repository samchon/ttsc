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
//
// @evidence contracts/testing.md#behavioral-verification run fix refuses emit with status2 and the explicit unsupported-emit diagnostic. This entry observes the refusal protocol; normal fix tests own rewritten source bytes and emit tests own output artifacts.
// @evidence contracts/testing.md#independent-expectations Fix is a source-edit operation with emission disabled; literal emit input and fixed refusal context independently establish the usage result.
// @evidence contracts/testing.md#distinguishing-cases Owns direct sidecar bypass of launcher validation with a legitimate fixture project; normal fix application and suggestion-only preservation are separate cases.
// @evidence contracts/testing.md#execution-ownership TestCommandFixRejectsEmitFlag is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
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
