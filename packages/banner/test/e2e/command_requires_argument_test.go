package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRequiresArgument verifies the banner sidecar rejects an empty command line.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// The native host must fail before project loading when no command is supplied. That keeps
// usage errors separate from TypeScript diagnostics and gives package managers a stable
// exit-code contract.
//
// 1. Run the real plugin binary without a subcommand.
// 2. Capture the native producer exit status and separate streams.
// 3. Assert the usage diagnostic and command-error exit code.
// @evidence contracts/testing.md#behavioral-verification The compiled banner sidecar receives no arguments and must return status 2, empty stdout and command required in stderr.
// @evidence contracts/testing.md#independent-expectations An empty invocation is a usage failure under the sidecar command contract; the expected status and diagnostic are literal, not computed by the wrapper.
// @evidence contracts/testing.md#distinguishing-cases This entry isolates empty argv from an unsupported token and a flag-shaped token; it does not supply a project that could obscure the usage failure.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRequiresArgument entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary This one native invocation checks the package entrypoint propagates an empty-argv failure into its actual exit and streams. Portable dispatch semantics are a possible direct-unit migration; this entry alone does not establish that migration.
// @evidence contracts/e2e.md#shared-execution All banner command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRequiresArgument, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRequiresArgument inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRequiresArgument(t *testing.T) {
  // Command assertion: this is the front-door guard for malformed invocations
  // from a wrapper script or an incorrectly constructed plugin descriptor.
  code, stdout, stderr := runPlugin(t)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
