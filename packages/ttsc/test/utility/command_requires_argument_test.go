package ttsc_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityCommandRequiresArgument Verifies an empty command vector reports
// the usage failure on stderr without metadata or compiler output.
//
// A nil vector and an allocated empty vector carry the same missing-command
// meaning; an explicit empty first token belongs to unknown-command coverage.
//
// 1. Invoke each package identity with nil and empty argv.
// 2. Require status 2, empty stdout and the complete literal usage diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification RunCommandWithIO rejects nil and empty argv with status 2, no stdout and the exact package-specific command-required message.
// @evidence contracts/testing.md#independent-expectations Empty argv cannot select build, transform, check or metadata; literal status and complete diagnostics establish the usage contract without querying another dispatcher.
// @evidence contracts/testing.md#distinguishing-cases Nil and allocated-empty vectors are exercised for all three package identities; an empty string token and flag-shaped first token have separate unknown-command subtests.
// @evidence contracts/testing.md#execution-ownership Go TestUtilityCommandRequiresArgument under test/utility calls the production dispatch with invocation-owned buffers, without creating a project, producer or process.
func TestUtilityCommandRequiresArgument(t *testing.T) {
  cases := []struct {
    name     string
    expected string
  }{
    {"@ttsc/banner", "@ttsc/banner: command required (expected build|transform|check|version)\n"},
    {"@ttsc/paths", "@ttsc/paths: command required (expected build|transform|check|version)\n"},
    {"@ttsc/strip", "@ttsc/strip: command required (expected build|transform|check|version)\n"},
  }
  for _, tc := range cases {
    for _, args := range [][]string{nil, {}} {
      t.Run(tc.name, func(t *testing.T) {
        var stdout, stderr bytes.Buffer
        code := utility.RunCommandWithIO(tc.name, "0.0.1", args, &stdout, &stderr)
        if code != 2 || stdout.String() != "" || stderr.String() != tc.expected {
          t.Fatalf("missing command mismatch: code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
        }
      })
    }
  }
}
