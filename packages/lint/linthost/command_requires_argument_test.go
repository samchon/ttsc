package linthost

import (
  "strings"
  "testing"
)

// TestCommandRequiresArgument verifies the lint sidecar rejects an empty command line.
//
// The lint binary is a host-facing command wrapper, so missing command handling
// must fail before project loading, tsconfig parsing, or rule setup begins.
//
// This scenario protects the sidecar protocol error path. A host that spawns
// the binary without a subcommand should receive a stable usage diagnostic and
// the command-error status.
//
// 1. Invoke the command front door with no arguments.
// 2. Capture the real process streams written by run.
// 3. Assert the command-error status and required-command diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification run(nil) returns status2 with empty stdout and a required-command usage diagnostic.
// @evidence contracts/testing.md#independent-expectations An empty argument list cannot name a supported operation; literal status2 and command-required context establish the independent usage result.
// @evidence contracts/testing.md#distinguishing-cases Owns the empty-command boundary; unsupported nonempty command and successful version entry are complementary cases.
// @evidence contracts/testing.md#execution-ownership TestCommandRequiresArgument is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
func TestCommandRequiresArgument(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run(nil)
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
    t.Fatalf("empty command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
