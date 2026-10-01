package linthost

import (
  "strings"
  "testing"
)

// TestCommandTransformRequiresFile verifies transform rejects a missing source file.
//
// Transform is the single-file command branch, so --file is its required input.
// The command must fail during flag validation before project loading or rule
// parsing.
//
// This scenario protects the host protocol for transform callers. A missing
// file argument is a usage error, not a TypeScript diagnostic.
//
// 1. Invoke transform without --file.
// 2. Capture stderr from the command front door.
// 3. Assert the command-error status and required-file diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification run transform without --file returns status2, no stdout and the required-file diagnostic before project work.
// @evidence contracts/testing.md#independent-expectations Transform requires a source file; the literal missing argument and --file is required diagnostic establish an independent usage error.
// @evidence contracts/testing.md#distinguishing-cases Owns an otherwise known transform command missing its mandatory option; requested-file output and path normalization execute separately.
// @evidence contracts/testing.md#execution-ownership TestCommandTransformRequiresFile is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
func TestCommandTransformRequiresFile(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"transform"})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "--file is required") {
    t.Fatalf("transform missing file mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
