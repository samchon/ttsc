package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the banner sidecar rejects unknown subcommands.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Unknown command handling protects the sidecar protocol between ttsc and the package binary.
// The command should fail early with a wrapper-level diagnostic instead of falling through to
// project compilation.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the sidecar exit status and stderr.
// 3. Assert the command-error status and unknown-command diagnostic.
// @evidence contracts/testing.md#behavioral-verification The compiled banner sidecar receives output and must return status 2, empty stdout and an unknown command diagnostic.
// @evidence contracts/testing.md#independent-expectations The sidecar supports check, transform, build and version, so output is an authored adjacent unsupported command.
// @evidence contracts/testing.md#distinguishing-cases The ordinary unsupported token differs from empty argv and --bogus, which have their own entries; successful operations are exercised by the build/check/transform cases.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsUnknown entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The actual package entrypoint must turn the rejected output token into a native status and stderr without entering a project command. Command classification itself is portable and remains a consolidation candidate.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one process with the single argument 'output' from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; the single process exits before the assertion. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, empty-stdout and 'unknown command' stderr checks are made in this body at L34; nothing is delegated to a unit test or helper.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: `output` used to be a tempting stage name, but this
  // native sidecar only accepts check, transform, build, and version.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
