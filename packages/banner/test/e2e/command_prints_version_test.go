package banner_test

import (
  "strings"
  "testing"
)

// TestCommandPrintsVersion verifies the banner sidecar exposes its version commands.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Version output is a host-discovery path rather than a project transform. The scenario checks
// the canonical command and both aliases so a broken project cannot mask command metadata or
// binary-probing regressions.
//
// 1. Invoke the version branch through the command name and both aliases.
// 2. Observe stdout and stderr exactly as the host would see them.
// 3. Assert a successful status and the @ttsc/banner banner text.
// @evidence contracts/testing.md#behavioral-verification The compiled banner sidecar receives version, -v and --version; each must return status zero, empty stderr and @ttsc/banner 0.0.1 on stdout.
// @evidence contracts/testing.md#independent-expectations The package identity and literal version are the authored metadata expectation; substring matching does not reject unrelated extra stdout.
// @evidence contracts/testing.md#distinguishing-cases Three accepted metadata spellings run without tsconfig or a manifest; malformed argv is covered by the sibling command-error entries.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandPrintsVersion entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary Three short independent native invocations preserve argv-to-status/stream wiring for the metadata aliases; alias parsing itself is portable and could move to a direct dispatch owner after exact coverage is established.
// @evidence contracts/e2e.md#shared-execution All banner command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandPrintsVersion, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandPrintsVersion inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandPrintsVersion(t *testing.T) {
  // Version assertion: wrappers use these paths to check binary identity
  // without paying the cost of compiler or plugin setup.
  for _, command := range []string{"version", "-v", "--version"} {
    code, stdout, stderr := runPlugin(t, command)
    if code != 0 || !strings.Contains(stdout, "@ttsc/banner 0.0.1") || stderr != "" {
      t.Fatalf("version branch mismatch for %s: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
