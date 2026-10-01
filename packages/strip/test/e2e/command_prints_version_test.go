//go:build e2e

package strip_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsVersion verifies the strip sidecar exposes its version commands.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// The version branch is command metadata and should not depend on a tsconfig fixture. Checking
// the command name and both aliases protects package discovery and smoke checks from
// project-specific failures.
//
// 1. Invoke the version branch through the command name and both aliases.
// 2. Capture the process streams exactly as the host would.
// 3. Assert successful status and the @ttsc/strip banner text.
// @evidence contracts/testing.md#behavioral-verification The compiled strip sidecar receives version, -v and --version; each must return status zero, empty stderr and @ttsc/strip 0.0.1 on stdout.
// @evidence contracts/testing.md#independent-expectations The package identity and literal version are the authored metadata expectation; substring matching does not reject unrelated extra stdout.
// @evidence contracts/testing.md#distinguishing-cases Three accepted metadata spellings run without tsconfig or a manifest; malformed argv is covered by the sibling command-error entries.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandPrintsVersion entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary Three short independent native invocations preserve argv-to-status/stream wiring for the metadata aliases; alias parsing itself is portable and could move to a direct dispatch owner after exact coverage is established.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts three separate processes (version, -v, --version) from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; each process exits before the next starts, so nothing carries between the three spellings. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, stderr and stdout checks for all three spellings are made in this body at L34; nothing is delegated to a unit test or helper, and the stdout substring match would not reject extra output.
func TestCommandPrintsVersion(t *testing.T) {
  // Version assertion: these are cheap binary identity checks for callers that
  // do not want to construct a TypeScript fixture.
  for _, command := range []string{"version", "-v", "--version"} {
    code, stdout, stderr := runPlugin(t, command)
    if code != 0 || !strings.Contains(stdout, "@ttsc/strip 0.0.1") || stderr != "" {
      t.Fatalf("version branch mismatch for %s: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
