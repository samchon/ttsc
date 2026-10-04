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
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go entry makes one actual command invocation with closed stdin and explicit cwd. Selection and runtime outcome are not certified by writing the body.
// @evidence contracts/e2e.md#necessary-boundary Actual main and default native LSP runner must transfer editor EOF to OS status zero; direct server calls do not test the executable/stdio connection.
// @evidence contracts/e2e.md#shared-execution This invocation consumes the suite's once-built ttscserver and once-resolved SDK binary. It uses a fresh process because stdin closure and exit end a host session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private cwd and invocation-local stdin/output buffers isolate the session. cmd.Run joins direct process and pipe copying; TestMain removes the suite build, without descendant certification.
// @evidence contracts/e2e.md#preserved-coverage Explicit cwd plus immediate EOF retains the original status-zero assertion; initialize responses, output bytes and implicit cwd have separate scopes.
func TestTtscserverCommandHandlesStdioShutdown(t *testing.T) {
  code, _, errOut := runTtscserverWithStdin(t, "", "--stdio", "--cwd", t.TempDir())
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
