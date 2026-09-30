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
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRejectsUnknown, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRejectsUnknown inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRejectsUnknown(t *testing.T) {
  // Command assertion: the sidecar intentionally accepts only check,
  // transform, build, and version.
  code, stdout, stderr := runPlugin(t, "output")
  if code != 2 || stdout != "" || !strings.Contains(stderr, "unknown command") {
    t.Fatalf("unknown branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
