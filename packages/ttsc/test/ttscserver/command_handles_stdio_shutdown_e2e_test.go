//go:build e2e

package ttscserver_test

import (
  "testing"
)

// TestTtscserverCommandHandlesStdioShutdown verifies the LSP host shuts down
// cleanly when the editor closes its end of stdin.
//
// EOF on stdin is the normal editor-driven shutdown signal. The host must
// return exit 0 through the runLSPServer happy path rather than treating the
// closed pipe as a crash and producing a non-zero exit code.
//
// 1. Run ttscserver --stdio with stdin closed immediately (empty payload).
// 2. Assert exit code 0.
//
// @evidence contracts/testing.md#behavioral-verification ttscserver --stdio with explicit cwd and immediate stdin EOF exits zero.
// @evidence contracts/testing.md#independent-expectations Editor-driven EOF is a normal shutdown signal; status zero is the independent transport lifecycle expectation.
// @evidence contracts/testing.md#distinguishing-cases Explicit cwd plus closed input exercises real host shutdown without an initialize exchange; the default-runner case independently proves a live response.
// @evidence contracts/testing.md#execution-ownership TestTtscserverCommandHandlesStdioShutdown is an individually discoverable Go E2E entry selected by the central ttsc package experiment; -tags=e2e separates it from direct units, and its loops retain each existing assertion and named subtest.
func TestTtscserverCommandHandlesStdioShutdown(t *testing.T) {
  code, _, errOut := runTtscserverWithStdin(t, "", "--stdio", "--cwd", t.TempDir())
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
