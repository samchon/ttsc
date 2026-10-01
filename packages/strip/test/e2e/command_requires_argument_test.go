//go:build e2e

package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRequiresArgument verifies the strip sidecar rejects an empty command line.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Missing command handling must stop before any project or strip pattern is inspected. That
// gives the host a stable usage failure instead of a misleading transform diagnostic.
//
// 1. Run the real plugin binary with no subcommand.
// 2. Capture stdout, stderr, and the wrapped exit status.
// 3. Assert the required-command diagnostic and command-error status.
// @evidence contracts/testing.md#behavioral-verification The compiled strip sidecar receives no arguments and must return status 2, empty stdout and command required in stderr.
// @evidence contracts/testing.md#independent-expectations An empty invocation is a usage failure under the sidecar command contract; the expected status and diagnostic are literal, not computed by the wrapper.
// @evidence contracts/testing.md#distinguishing-cases This entry isolates empty argv from an unsupported token and a flag-shaped token; it does not supply a project that could obscure the usage failure.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRequiresArgument entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary This one native invocation checks the package entrypoint propagates an empty-argv failure into its actual exit and streams. Portable dispatch semantics are a possible direct-unit migration; this entry alone does not establish that migration.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one process with no arguments from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; the single process exits before the assertion. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, empty-stdout and 'command required' stderr checks are made in this body at L32; nothing is delegated to a unit test or helper.
func TestCommandRequiresArgument(t *testing.T) {
  // Command assertion: this prevents an empty argv from falling through to
  // project loading or manifest parsing.
  code, stdout, stderr := runPlugin(t)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
