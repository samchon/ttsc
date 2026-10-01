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
// `normalizeFlagToken` in `packages/ttsc/src/flags/normalizeFlagToken.ts` is the one
// normalization every layer keys off, including `buildGoAllowList`, whose
// output is `linthost/flags_gen.go`. Keying this lookup on the exact spelling
// while the generated keys are normalized would drop a flag the launcher and
// the compiler both resolve, silently taking the following token with it.
//
//  1. Filter a case-variant value flag, a case-variant boolean flag, and an
//     unknown flag against a normalized allow-list.
//  2. Assert both known flags survive with their value adjacency intact.
//  3. Assert the unknown flag is still dropped together with its value.
//
// @evidence contracts/testing.md#behavioral-verification filterKnownFlags retains EMIT, OutDir with dist and inline CWD while dropping unknown Future and its following value.
// @evidence contracts/testing.md#independent-expectations The normalized flag-name contract is case-insensitive while output spelling and value adjacency stay unchanged; a literal complete expected vector is independent of the filter.
// @evidence contracts/testing.md#distinguishing-cases Owns case variants for Boolean, separate value and inline value, plus an unknown name; ordinary spelling and positional retention have a companion case.
// @evidence contracts/testing.md#execution-ownership TestFilterKnownFlagsResolvesNamesCaseInsensitively is a selected Go unit entry calling filterKnownFlags in-process and comparing preserved spelling, ordering and value adjacency without building a native artifact, installing a consumer or spawning a product process.
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
