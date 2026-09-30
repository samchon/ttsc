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
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRequiresArgument, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRequiresArgument inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRequiresArgument(t *testing.T) {
  // Command assertion: this prevents an empty argv from falling through to
  // project loading or manifest parsing.
  code, stdout, stderr := runPlugin(t)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
