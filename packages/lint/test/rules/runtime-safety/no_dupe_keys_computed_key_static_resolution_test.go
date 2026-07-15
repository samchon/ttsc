package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoDupeKeysComputedKeyStaticResolution pins no-dupe-keys to ESLint's
// getStaticPropertyName semantics for computed keys.
//
// A computed key contributes the static value of its literal argument, so
// `["a"]` collides with the identifier key `a`; a non-constant computed key
// (`[f()]`, `[x]`) contributes no key and can never collide. This guards the
// regression where computed keys were compared by their raw `[expr]` source
// text, which both missed a literal duplicate (`{ a: 1, ["a"]: 2 }` went
// unreported) and falsely flagged two distinct dynamic keys as identical
// (`{ [f()]: 1, [f()]: 2 }` reported a bogus duplicate).
//
//  1. Parse each object-literal fixture with no type checker (AST-only rule).
//  2. Run the engine with only no-dupe-keys enabled.
//  3. Assert the reported duplicate-key messages match the oracle exactly.
func TestNoDupeKeysComputedKeyStaticResolution(t *testing.T) {
  tests := []struct {
    name         string
    source       string
    wantMessages []string
  }{
    {
      name:         "computed string literal duplicates identifier key",
      source:       "const o = {\n  a: 1,\n  [\"a\"]: 2,\n};\n",
      wantMessages: []string{"Duplicate key 'a'."},
    },
    {
      name:         "computed numeric literal duplicates numeric key",
      source:       "const o = {\n  1: 1,\n  [1]: 2,\n};\n",
      wantMessages: []string{"Duplicate key '1'."},
    },
    {
      name:   "distinct calls in computed keys are not duplicates",
      source: "const o = {\n  [f()]: 1,\n  [f()]: 2,\n};\n",
    },
    {
      name:   "distinct identifier computed keys are not duplicates",
      source: "const o = {\n  [a]: 1,\n  [b]: 2,\n};\n",
    },
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      file := parseTS(t, test.source)
      findings := NewEngine(RuleConfig{"no-dupe-keys": SeverityError}).
        Run([]*shimast.SourceFile{file}, nil)
      got := make([]string, 0, len(findings))
      for _, finding := range findings {
        got = append(got, finding.Message)
      }
      if len(got) != len(test.wantMessages) {
        t.Fatalf("messages = %v, want %v", got, test.wantMessages)
      }
      for i := range got {
        if got[i] != test.wantMessages[i] {
          t.Fatalf("messages = %v, want %v", got, test.wantMessages)
        }
      }
    })
  }
}
