package main

import (
  "reflect"
  "testing"
)

// TestFilterHostArgsStripsUnknownForwardedFlag verifies cmd/ttsc's
// filterHostArgs drops forwarded tsgo options before fs.Parse so the
// FlagSet does not exit 2.
//
// `cmd/ttsc/{build,api_compile,api_transform}.go` use
// `flag.NewFlagSet(..., flag.ContinueOnError)` which exits non-zero on
// the first unknown flag it sees. The schema-generated allow-list in
// `flags_gen.go` (`HostFlagAllowList`) feeds this filter so a forwarded
// `--strict` from the JS launcher reaches the tsgo lane via
// `--tsgo-args=<JSON>` instead of crashing the build. This pins the
// behavior RCA #4 flagged as "next likely bug — `cmd/ttsc/build.go:42`
// uses bare `flag.FlagSet` with no filter and will exit".
//
//  1. Known flags + values survive (long form and `=` form).
//  2. Unknown flag with separate value (`--strict true`) is dropped
//     together with its value.
//  3. Unknown flag with inline value (`--target=ES2022`) is dropped.
//  4. `--` separator and everything after survives verbatim.
func TestFilterHostArgsStripsUnknownForwardedFlag(t *testing.T) {
  cases := []struct {
    name string
    in   []string
    want []string
  }{
    {
      name: "keeps known flags including values",
      in:   []string{"--tsconfig", "tsconfig.json", "--cwd=.", "--emit"},
      want: []string{"--tsconfig", "tsconfig.json", "--cwd=.", "--emit"},
    },
    {
      name: "drops unknown flag with separate value",
      in:   []string{"--tsconfig", "tsconfig.json", "--strict", "true", "--emit"},
      want: []string{"--tsconfig", "tsconfig.json", "--emit"},
    },
    {
      name: "drops unknown flag with inline value",
      in:   []string{"--tsconfig=tsconfig.json", "--target=ES2022"},
      want: []string{"--tsconfig=tsconfig.json"},
    },
    {
      name: "double dash preserves trailing tokens",
      in:   []string{"--tsconfig=tsconfig.json", "--", "--anything", "src/main.ts"},
      want: []string{"--tsconfig=tsconfig.json", "--", "--anything", "src/main.ts"},
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
