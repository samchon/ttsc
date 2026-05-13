package main

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
// 1. Build a mixed argument list with known and future flags.
// 2. Filter it against the check/build flag contract.
// 3. Assert known values and positional arguments are preserved in order.
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
    "outDir":       true,
    "plugins-json": true,
  })
  want := []string{"--emit", "--cwd", "/repo", "--plugins-json={}", "positional.ts", "--outDir", "dist"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("filtered flags mismatch: want %v, got %v", want, got)
  }
}
