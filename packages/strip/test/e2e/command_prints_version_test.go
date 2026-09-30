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
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandPrintsVersion, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandPrintsVersion inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
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
