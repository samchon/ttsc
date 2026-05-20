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
func TestUtilityBuildRejectsConflictingEmitFlags(t *testing.T) {
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{"--emit", "--noEmit"})
  })
  if code != 2 || out != "" || !strings.Contains(errOut, "mutually exclusive") {
    t.Fatalf("conflicting emit flags mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
}
