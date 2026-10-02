package ttsc_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityBuildRejectsConflictingEmitFlags verifies emit intent validation.
//
// The utility host backs linked transform packages.
// Its build command must reject contradictory wrapper flags before project
// loading so all utility plugins share the same command contract as ttsc and
// @ttsc/lint.
//
// 1. Invoke the utility build entrypoint with both --emit and --noEmit.
// 2. Capture the command-style stdout and stderr streams.
// 3. Assert the usage failure reports a mutual-exclusion diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification RunBuild with both --emit and --noEmit returns usage status 2, prints nothing to stdout and reports that the flags are mutually exclusive.
// @evidence contracts/testing.md#independent-expectations Status 2, empty stdout and the 'mutually exclusive' phrase are literal command-contract values.
// @evidence contracts/testing.md#distinguishing-cases The contradictory pair is rejected before any project is loaded; the single-flag builds in sibling tests are the accepted neighbors.
// @evidence contracts/testing.md#execution-ownership TestUtilityBuildRejectsConflictingEmitFlags is a Go unit test in the test/utility process: it calls the utility host entrypoint in-process with captured streams and a temporary project, installing no consumer and starting no product process.
func TestUtilityBuildRejectsConflictingEmitFlags(t *testing.T) {
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--emit", "--noEmit"})
  })
  if code != 2 || out != "" || !strings.Contains(errOut, "mutually exclusive") {
    t.Fatalf("conflicting emit flags mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
