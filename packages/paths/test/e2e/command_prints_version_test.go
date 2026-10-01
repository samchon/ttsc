package paths_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsVersion verifies the paths sidecar exposes its version commands.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Version output is pure command metadata. It must stay available through the command name and
// both aliases without a project directory, path aliases, or plugin JSON so package discovery can
// run independently.
//
// 1. Invoke the version branch through the command name and both aliases.
// 2. Capture stdout and stderr without a project fixture.
// 3. Assert successful status and the @ttsc/paths banner text.
// @evidence contracts/testing.md#behavioral-verification The compiled paths sidecar receives version, -v and --version; each must return status zero, empty stderr and @ttsc/paths 0.0.1 on stdout.
// @evidence contracts/testing.md#independent-expectations The package identity and literal version are the authored metadata expectation; substring matching does not reject unrelated extra stdout.
// @evidence contracts/testing.md#distinguishing-cases Three accepted metadata spellings run without tsconfig or a manifest; malformed argv is covered by the sibling command-error entries.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandPrintsVersion entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary Three short independent native invocations preserve argv-to-status/stream wiring for the metadata aliases; alias parsing itself is portable and could move to a direct dispatch owner after exact coverage is established.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts three separate processes (version, -v, --version) from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; each process exits before the next starts, so nothing carries between the three spellings. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, stderr and stdout checks for all three spellings are made in this body at L34; nothing is delegated to a unit test or helper, and the stdout substring match would not reject extra output.
func TestCommandPrintsVersion(t *testing.T) {
  // Version assertion: these paths are intentionally independent of tsconfig
  // and plugin manifest parsing.
  for _, command := range []string{"version", "-v", "--version"} {
    code, stdout, stderr := runPlugin(t, command)
    if code != 0 || !strings.Contains(stdout, "@ttsc/paths 0.0.1") || stderr != "" {
      t.Fatalf("version branch mismatch for %s: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
