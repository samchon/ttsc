package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsFlagShapedCommand rejects banner flag-shaped commands.
//
// The banner wrapper sees the first argv entry before the shared utility host can parse command
// flags. A malformed host invocation that starts with an option must therefore fail as an unknown
// command instead of reaching project compilation.
//
// This keeps wrapper-level protocol errors distinct from build, transform, and check flag
// parsing. The command is shaped like a flag to cover the path where a caller forgets the
// subcommand entirely.
//
// 1. Invoke the real wrapper with a flag-shaped first argument.
// 2. Capture stdout, stderr, and the wrapped process status.
// 3. Assert the wrapper reports an unknown command with command-error status.
// @evidence contracts/testing.md#behavioral-verification The compiled banner sidecar receives --bogus as its first argument and must return status 2, empty stdout and the quoted unknown command "--bogus" diagnostic.
// @evidence contracts/testing.md#independent-expectations A first argv option does not supply a sidecar command; the literal quoted token distinguishes command rejection from later utility flag parsing.
// @evidence contracts/testing.md#distinguishing-cases The flag-shaped token is distinct from the ordinary output token and missing argv; no project or manifest is supplied.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsFlagShapedCommand entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary A real process preserves the malformed first argument and exposes wrapper status/stderr. This duplicates part of generic dispatch transport and cannot justify an extra native build; portable argv decisions remain candidates for direct units.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one process with the single argument --bogus from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; the single process exits before the assertion. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, empty-stdout and quoted-token stderr checks are made in this body at L33; nothing is delegated to a unit test or helper.
func TestCommandRejectsFlagShapedCommand(t *testing.T) {
  // Command assertion: the wrapper should reject the malformed command before
  // delegating to utility flag parsing.
  code, stdout, stderr := runPlugin(t, "--bogus")
  if code != 2 || stdout != "" || !strings.Contains(stderr, `unknown command "--bogus"`) {
    t.Fatalf("flag-shaped command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
