package main

import (
  "reflect"
  "testing"
)

// TestFilterHostArgsResolvesFlagNamesCaseInsensitively verifies case-insensitive host filtering preserves known argv and removes unknown values.
//
// The filter looks up lower-case generated option names but deliberately preserves original token spelling. Exact output argv assertions observe filtering only; they do not prove that the subsequent Go FlagSet accepts an upper-case spelling.
//
// 1. Filter case-variant value and boolean options.
// 2. Compare surviving token arrays with literal expectations.
// 3. Filter an unknown mixed-case option together with its separate value.
//
// @evidence contracts/testing.md#behavioral-verification Direct filterHostArgs returns exactly the literal retained argv for upper-case value/boolean keys and removes a mixed-case unknown option plus its value.
// @evidence contracts/testing.md#independent-expectations Authored input/output arrays distinguish known-name normalization, boolean operand ownership and unknown stripping without generating expected argv from the filter or its allow-list.
// @evidence contracts/testing.md#distinguishing-cases Known case-variant value, known case-variant boolean and unknown mixed-case value cases contrast preservation and removal; the companion filter test owns inline values and double-dash boundaries.
// @evidence contracts/testing.md#execution-ownership This portable same-process Go unit calls the actual private argv filter with no fixture, compiler load, installed host or process. Named table subtests retain each input and failure identity; subsequent FlagSet parsing is outside the asserted operation.
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
