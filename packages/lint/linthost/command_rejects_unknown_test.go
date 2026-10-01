package linthost

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the lint sidecar rejects unknown subcommands.
//
// Unknown command handling belongs to the wrapper, not to tsgo project loading.
// The sidecar should fail before it attempts to parse flags or read compiler
// configuration.
//
// This scenario protects the native host protocol. Unsupported command names
// must produce a wrapper-level diagnostic and a command-error status.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the run front door's stdout and stderr streams.
// 3. Assert the unknown-command diagnostic and command-error status.
//
// @evidence contracts/testing.md#behavioral-verification run rejects the unsupported wat command with status2, empty stdout and an unknown-command diagnostic.
// @evidence contracts/testing.md#independent-expectations The command vocabulary does not contain wat; literal error status and message meaning independently distinguish usage rejection from project diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Owns an unrecognized nonempty command; absent command and accepted version routes are separate cases.
// @evidence contracts/testing.md#execution-ownership TestCommandRejectsUnknown is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
func TestCommandRejectsUnknown(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"wat"})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
