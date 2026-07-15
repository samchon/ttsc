package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoReturnAssignAllowsParenthesizedAssignment verifies no-return-assign
// follows ESLint's default `except-parens`: a bare assignment operand fires,
// but a parenthesized one is allowed — and the `always` option opts the
// parenthesized form back in.
//
// The port previously stripped parentheses before the assignment test, so
// `return (a = 1)` was flagged even though the ESLint default treats the
// explicit parentheses as an intentional assignment. The operand is now tested
// as written (a wrapping parenthesized expression is not a binary assignment),
// matching the parenthesis exemption `no-cond-assign` already applies, with
// `always` restoring the strip-then-test behavior.
//
//  1. Assert bare `return a = 1` and `=> a = 1` each report exactly once.
//  2. Assert their parenthesized twins report nothing under the default.
//  3. Assert the `"always"` option flags both parenthesized forms.
func TestNoReturnAssignAllowsParenthesizedAssignment(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    options string
    want    int
  }{
    {
      name:   "bare return assignment fires",
      source: "function f(a: number) {\n  return a = 1;\n}\nJSON.stringify(f);\n",
      want:   1,
    },
    {
      name:   "parenthesized return assignment is allowed",
      source: "function f(a: number) {\n  return (a = 1);\n}\nJSON.stringify(f);\n",
      want:   0,
    },
    {
      name:   "bare arrow assignment fires",
      source: "const g = (a: number) => a = 1;\nJSON.stringify(g);\n",
      want:   1,
    },
    {
      name:   "parenthesized arrow assignment is allowed",
      source: "const g = (a: number) => (a = 1);\nJSON.stringify(g);\n",
      want:   0,
    },
    {
      name:    "always option flags the parenthesized return",
      source:  "function f(a: number) {\n  return (a = 1);\n}\nJSON.stringify(f);\n",
      options: "\"always\"",
      want:    1,
    },
    {
      name:    "always option flags the parenthesized arrow",
      source:  "const g = (a: number) => (a = 1);\nJSON.stringify(g);\n",
      options: "\"always\"",
      want:    1,
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      var opts json.RawMessage
      if test.options != "" {
        opts = json.RawMessage(test.options)
      }
      _, _, findings := runRuleFindingsSnapshot(t, "no-return-assign", test.source, opts)
      if len(findings) != test.want {
        t.Fatalf(
          "no-return-assign %q: want %d findings, got %d (%+v)",
          test.name,
          test.want,
          len(findings),
          findings,
        )
      }
    })
  }
}
