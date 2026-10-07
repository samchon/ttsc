package main

import (
  "reflect"
  "testing"
)

// TestFilterHostArgsStripsUnknownForwardedFlag verifies forwarded unknown options are removed while declared argv and double-dash tails survive.
//
// The filter prevents unknown forwarded options from reaching a local ContinueOnError FlagSet through this argument lane. ContinueOnError returns a parsing error; this unit asserts exact filtering results and does not run the downstream parser or prove forwarded compiler-option delivery.
//
// 1. Preserve declared value, inline-value and boolean argv.
// 2. Remove unknown options with separate and inline values.
// 3. Preserve double-dash and the entire remaining token tail.
//
// @evidence contracts/testing.md#behavioral-verification Direct filterHostArgs produces exact literal argv arrays for known options, unknown separate/inline options and the double-dash tail.
// @evidence contracts/testing.md#independent-expectations Literal expected arrays follow independently from local host-option ownership and the double-dash boundary; they are not computed from actual output or generated allow-list contents.
// @evidence contracts/testing.md#distinguishing-cases Positive known-option preservation contrasts unknown value removal, with inline and separate values and a terminal double-dash boundary; case normalization belongs to the companion filter unit.
// @evidence contracts/testing.md#execution-ownership This portable Go unit calls the actual private filtering operation and keeps four named subcases. It performs no FlagSet parse, native Program load, fixture access or subprocess; downstream command status and tsgo forwarding remain other owners.
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
