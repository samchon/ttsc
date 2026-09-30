package paths_test

import (
  "strings"
  "testing"
)

// TestCommandRequiresArgument verifies the paths sidecar rejects an empty command line.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// The wrapper must report missing commands before resolving tsconfig paths. This protects the
// sidecar protocol from accidentally treating an invalid host call as a project diagnostic.
//
// 1. Run the real plugin binary without a subcommand.
// 2. Capture the native producer exit status and stderr.
// 3. Assert the command-error status and required-command message.
// @evidence contracts/testing.md#behavioral-verification The compiled paths sidecar receives no arguments and must return status 2, empty stdout and command required in stderr.
// @evidence contracts/testing.md#independent-expectations An empty invocation is a usage failure under the sidecar command contract; the expected status and diagnostic are literal, not computed by the wrapper.
// @evidence contracts/testing.md#distinguishing-cases This entry isolates empty argv from an unsupported token and a flag-shaped token; it does not supply a project that could obscure the usage failure.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRequiresArgument entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary This one native invocation checks the package entrypoint propagates an empty-argv failure into its actual exit and streams. Portable dispatch semantics are a possible direct-unit migration; this entry alone does not establish that migration.
// @evidence contracts/e2e.md#shared-execution All paths command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRequiresArgument, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRequiresArgument inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRequiresArgument(t *testing.T) {
  // Command assertion: this is the guard that catches host-side invocation
  // mistakes before project loading begins.
  code, stdout, stderr := runPlugin(t)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
