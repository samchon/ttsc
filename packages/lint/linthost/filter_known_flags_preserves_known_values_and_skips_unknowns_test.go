package linthost

import (
  "reflect"
  "testing"
)

// TestFilterKnownFlagsPreservesKnownValuesAndSkipsUnknowns verifies host flag filtering.
//
// The lint sidecar is invoked by hosts that may grow new optional flags before
// older native binaries understand them. filterKnownFlags must keep known flag
// values intact while dropping unknown flags and their standalone values.
//
// This scenario covers boolean flags, --flag=value syntax, known value flags,
// unknown value flags, and positional arguments in one direct helper test.
//
// The `known` map models the generated `LintFlagAllowList`, whose keys are
// produced by `normalizeFlagToken` in `packages/ttsc/src/flags/normalizeFlagToken.ts` and
// are therefore lower-cased. The double keys them the same way, or it would
// stop being a faithful stand-in for the map the sidecar actually receives.
//
// 1. Build a mixed argument list with known and future flags.
// 2. Filter it against the check/build flag contract.
// 3. Assert known values and positional arguments are preserved in order.
//
// @evidence contracts/testing.md#behavioral-verification filterKnownFlags preserves the exact order of known Boolean/value/equals flags and positional source while dropping unknown flags with their values.
// @evidence contracts/testing.md#independent-expectations The authored allow-list marks value-taking versus Boolean flags; an independent literal complete argument vector establishes preservation and omission without rerunning filtering logic.
// @evidence contracts/testing.md#distinguishing-cases Owns bare Boolean, separate known value, equals-value, unknown separate/inline values and positional argument in one mixed input; case-variant names are separate.
// @evidence contracts/testing.md#execution-ownership TestFilterKnownFlagsPreservesKnownValuesAndSkipsUnknowns is a selected Go unit entry calling filterKnownFlags in-process and comparing the complete returned argument vector without building a native artifact, installing a consumer or spawning a product process.
func TestFilterKnownFlagsPreservesKnownValuesAndSkipsUnknowns(t *testing.T) {
  got := filterKnownFlags([]string{
    "--emit",
    "--future", "drop-me",
    "--cwd", "/repo",
    "--plugins-json={}",
    "--unknown=value",
    "positional.ts",
    "--outDir", "dist",
  }, map[string]bool{
    "cwd":          true,
    "emit":         false,
    "outdir":       true,
    "plugins-json": true,
  })
  want := []string{"--emit", "--cwd", "/repo", "--plugins-json={}", "positional.ts", "--outDir", "dist"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("filtered flags mismatch: want %v, got %v", want, got)
  }
}
