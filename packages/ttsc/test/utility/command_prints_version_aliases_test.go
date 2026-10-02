package ttsc_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityCommandPrintsVersionAliases Verifies all metadata spellings write
// the package identity and supplied version without entering a project command.
//
// Trailing command-shaped or malformed host arguments remain ignored after a
// metadata alias, matching the standalone entrypoints' first-token semantics.
//
// 1. Call the shared production dispatch for three identities and three aliases.
// 2. Repeat each alias with trailing build and malformed manifest arguments.
// 3. Require exact metadata bytes, status zero and no stderr for every call.
//
// @evidence contracts/testing.md#behavioral-verification RunCommandWithIO returns zero, exact newline-terminated identity/version stdout and empty stderr for version, -v and --version, including ignored trailing host arguments.
// @evidence contracts/testing.md#independent-expectations Literal expected output for each authored package identity and supplied 0.0.1 version pins the metadata formatting independently of the command implementation; this is an output behavior test, not repository metadata inspection.
// @evidence contracts/testing.md#distinguishing-cases All three accepted aliases run for banner, paths and strip both alone and before build plus malformed plugins JSON; malformed first tokens are owned by the unknown-command unit.
// @evidence contracts/testing.md#execution-ownership Go TestUtilityCommandPrintsVersionAliases under test/utility invokes the actual shared dispatch used by all three standalone entrypoints, with local bytes.Buffer writers and no native producer, installation or child.
func TestUtilityCommandPrintsVersionAliases(t *testing.T) {
  cases := []struct {
    name     string
    expected string
  }{
    {"@ttsc/banner", "@ttsc/banner 0.0.1\n"},
    {"@ttsc/paths", "@ttsc/paths 0.0.1\n"},
    {"@ttsc/strip", "@ttsc/strip 0.0.1\n"},
  }
  for _, tc := range cases {
    for _, alias := range []string{"version", "-v", "--version"} {
      for _, trailing := range [][]string{nil, {"build", "--plugins-json={"}} {
        t.Run(tc.name+"/"+alias+"/"+string(rune('0'+len(trailing))), func(t *testing.T) {
          args := append([]string{alias}, trailing...)
          var stdout, stderr bytes.Buffer
          code := utility.RunCommandWithIO(tc.name, "0.0.1", args, &stdout, &stderr)
          if code != 0 || stdout.String() != tc.expected || stderr.String() != "" {
            t.Fatalf("metadata mismatch: code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
          }
        })
      }
    }
  }
}
