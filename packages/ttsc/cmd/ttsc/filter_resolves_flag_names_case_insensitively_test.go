package main

import (
  "reflect"
  "testing"
)

// TestFilterHostArgsResolvesFlagNamesCaseInsensitively verifies the host
// allow-list lookup applies the same flag-name normalization the schema uses
// when it generates that allow-list.
//
// TypeScript's option parser matches option names case-insensitively, and
// `normalizeFlagToken` in `packages/ttsc/src/flags/schema.ts` is the one
// normalization every layer keys off — including `buildGoAllowList`, whose
// output is `flags_gen.go`. Keying this lookup on the exact spelling while the
// generated keys are normalized would recreate the split-brain one layer
// further down: a flag the launcher and the compiler both resolve would be
// dropped here, silently taking the following token with it.
//
//  1. A case-variant known flag survives with its value.
//  2. A case-variant boolean known flag survives and does not eat the next token.
//  3. An unknown flag is still dropped in every casing, with its value.
func TestFilterHostArgsResolvesFlagNamesCaseInsensitively(t *testing.T) {
  cases := []struct {
    name string
    in   []string
    want []string
  }{
    {
      name: "keeps a case-variant value flag with its value",
      in:   []string{"--TSCONFIG", "tsconfig.json", "--CWD=."},
      want: []string{"--TSCONFIG", "tsconfig.json", "--CWD=."},
    },
    {
      name: "keeps a case-variant boolean flag without eating the next token",
      in:   []string{"--NOEMIT", "--tsconfig", "tsconfig.json"},
      want: []string{"--NOEMIT", "--tsconfig", "tsconfig.json"},
    },
    {
      name: "still drops an unknown flag in any casing",
      in:   []string{"--tsconfig=tsconfig.json", "--sTrIcT", "true"},
      want: []string{"--tsconfig=tsconfig.json"},
    },
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      got := filterHostArgs(tc.in)
      if !reflect.DeepEqual(got, tc.want) {
        t.Fatalf("filterHostArgs(%v):\n  want %v\n  got  %v", tc.in, tc.want, got)
      }
    })
  }
}
