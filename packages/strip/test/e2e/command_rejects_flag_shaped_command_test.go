package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsFlagShapedCommand rejects strip flag-shaped commands.
//
// The strip wrapper sees the first argv entry before the shared utility host can parse strip
// command flags. A malformed host invocation that starts with an option must therefore fail as an
// unknown command.
//
// This keeps wrapper-level protocol errors distinct from project diagnostics and strip
// configuration failures. No fixture is needed because the command should stop at dispatch.
//
// 1. Invoke the real wrapper with a flag-shaped first argument.
// 2. Capture stdout, stderr, and the wrapped process status.
// 3. Assert the wrapper reports an unknown command with command-error status.
// @evidence contracts/testing.md#behavioral-verification The compiled strip sidecar receives --bogus as its first argument and must return status 2, empty stdout and the quoted unknown command "--bogus" diagnostic.
// @evidence contracts/testing.md#independent-expectations A first argv option does not supply a sidecar command; the literal quoted token distinguishes command rejection from later utility flag parsing.
// @evidence contracts/testing.md#distinguishing-cases The flag-shaped token is distinct from the ordinary output token and missing argv; no project or manifest is supplied.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsFlagShapedCommand entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary A real process preserves the malformed first argument and exposes wrapper status/stderr. This duplicates part of generic dispatch transport and cannot justify an extra native build; portable argv decisions remain candidates for direct units.
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRejectsFlagShapedCommand, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRejectsFlagShapedCommand inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRejectsFlagShapedCommand(t *testing.T) {
  // Command assertion: the wrapper should reject the malformed command before
  // delegating to utility flag parsing.
  code, stdout, stderr := runPlugin(t, "--bogus")
  if code != 2 || stdout != "" || !strings.Contains(stderr, `unknown command "--bogus"`) {
    t.Fatalf("flag-shaped command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
