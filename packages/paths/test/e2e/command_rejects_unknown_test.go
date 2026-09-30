package paths_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsUnknown verifies the paths sidecar rejects unknown subcommands.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Unknown-command handling belongs to the package wrapper, not the compiler host. The scenario
// ensures invalid protocol input fails before alias rewriting or project loading begins.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Observe the wrapper-level stderr text.
// 3. Assert the command-error status and unknown-command diagnostic.
// @evidence contracts/testing.md#behavioral-verification The compiled paths sidecar receives output and must return status 2, empty stdout and an unknown command diagnostic.
// @evidence contracts/testing.md#independent-expectations The sidecar supports check, transform, build and version, so output is an authored adjacent unsupported command.
// @evidence contracts/testing.md#distinguishing-cases The ordinary unsupported token differs from empty argv and --bogus, which have their own entries; successful operations are exercised by the build/check/transform cases.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsUnknown entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The actual package entrypoint must turn the rejected output token into a native status and stderr without entering a project command. Command classification itself is portable and remains a consolidation candidate.
// @evidence contracts/e2e.md#shared-execution All paths command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRejectsUnknown, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRejectsUnknown inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: output-stage sidecars are not supported for this
  // package; only check, transform, build, and version are valid.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
