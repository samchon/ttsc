package ttsc_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityCommandRejectsUnknown Verifies unsupported first tokens stay
// command errors even when a following token names a valid host operation.
//
// The dispatcher owns the first token. A flag-shaped token is not parsed as a
// host option, and an empty token differs from an absent argument vector.
//
// 1. Supply output, --bogus and an empty token for each package identity.
// 2. Repeat each original single-token input with an appended check token.
// 3. Require status 2, empty stdout and the exact quoted-token diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification RunCommandWithIO returns status 2 and exact unknown-command stderr with no stdout for output, --bogus and an empty first token both alone and before trailing check.
// @evidence contracts/testing.md#independent-expectations Literal diagnostics preserve the authored token's quoted representation; the unsupported first token cannot inherit a later valid command's meaning.
// @evidence contracts/testing.md#distinguishing-cases Ordinary, flag-shaped and empty first tokens run both alone and before check under each of the three package identities; missing argv is owned by the command-required unit and metadata aliases by the version unit.
// @evidence contracts/testing.md#execution-ownership Go TestUtilityCommandRejectsUnknown under test/utility invokes actual production dispatch and observes only local buffers and status, without a native host or fixture.
func TestUtilityCommandRejectsUnknown(t *testing.T) {
  cases := []struct {
    name     string
    token    string
    expected string
  }{
    {"@ttsc/banner", "output", "@ttsc/banner: unknown command \"output\"\n"},
    {"@ttsc/banner", "--bogus", "@ttsc/banner: unknown command \"--bogus\"\n"},
    {"@ttsc/banner", "", "@ttsc/banner: unknown command \"\"\n"},
    {"@ttsc/paths", "output", "@ttsc/paths: unknown command \"output\"\n"},
    {"@ttsc/paths", "--bogus", "@ttsc/paths: unknown command \"--bogus\"\n"},
    {"@ttsc/paths", "", "@ttsc/paths: unknown command \"\"\n"},
    {"@ttsc/strip", "output", "@ttsc/strip: unknown command \"output\"\n"},
    {"@ttsc/strip", "--bogus", "@ttsc/strip: unknown command \"--bogus\"\n"},
    {"@ttsc/strip", "", "@ttsc/strip: unknown command \"\"\n"},
  }
  for _, tc := range cases {
    for _, suffix := range []struct {
      label string
      args  []string
    }{{"alone", nil}, {"trailing-check", []string{"check"}}} {
      t.Run(tc.name+"/"+tc.token+"/"+suffix.label, func(t *testing.T) {
        args := append([]string{tc.token}, suffix.args...)
        var stdout, stderr bytes.Buffer
        code := utility.RunCommandWithIO(tc.name, "0.0.1", args, &stdout, &stderr)
        if code != 2 || stdout.String() != "" || stderr.String() != tc.expected {
          t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
        }
      })
    }
  }
}
