//go:build e2e

package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the strip sidecar rejects unknown subcommands.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Unknown-command handling is part of the wrapper protocol. The scenario ensures unsupported
// host input never reaches the stripping engine or project compiler path.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the wrapper-level diagnostic.
// 3. Assert the command-error status and unknown-command message.
// @evidence contracts/testing.md#behavioral-verification The compiled strip sidecar receives output and must return status 2, empty stdout and an unknown command diagnostic.
// @evidence contracts/testing.md#independent-expectations The sidecar supports check, transform, build and version, so output is an authored adjacent unsupported command.
// @evidence contracts/testing.md#distinguishing-cases The ordinary unsupported token differs from empty argv and --bogus, which have their own entries; successful operations are exercised by the build/check/transform cases.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsUnknown entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The actual package entrypoint must turn the rejected output token into a native status and stderr without entering a project command. Command classification itself is portable and remains a consolidation candidate.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one process with the single argument 'output' from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; the single process exits before the assertion. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, empty-stdout and 'unknown command' stderr checks are made in this body at L32; nothing is delegated to a unit test or helper.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: the sidecar intentionally accepts only check,
  // transform, build, and version.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
