package linthost

import (
  "reflect"
  "testing"
)

// TestFilterKnownFlagsResolvesNamesCaseInsensitively verifies the lint
// allow-list lookup applies the same flag-name normalization the schema uses
// when it generates that allow-list.
//
// TypeScript's option parser matches option names case-insensitively, and
// `normalizeFlagToken` in `packages/ttsc/src/flags/schema.ts` is the one
// normalization every layer keys off, including `buildGoAllowList`, whose
// output is `linthost/flags_gen.go`. Keying this lookup on the exact spelling
// while the generated keys are normalized would drop a flag the launcher and
// the compiler both resolve, silently taking the following token with it.
//
// 1. Filter a case-variant value flag, a case-variant boolean flag, and an
//    unknown flag against a normalized allow-list.
// 2. Assert both known flags survive with their value adjacency intact.
// 3. Assert the unknown flag is still dropped together with its value.
func TestFilterKnownFlagsResolvesNamesCaseInsensitively(t *testing.T) {
  got := filterKnownFlags([]string{
    "--EMIT",
    "--OutDir", "dist",
    "--Future", "drop-me",
    "--CWD=/repo",
  }, map[string]bool{
    "cwd":    true,
    "emit":   false,
    "outdir": true,
  })
  want := []string{"--EMIT", "--OutDir", "dist", "--CWD=/repo"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("filtered flags mismatch: want %v, got %v", want, got)
  }
}
