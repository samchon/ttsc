package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocRejectsMalformedTagSynonymValue verifies the rule
// silently drops user-supplied tagSynonyms entries whose canonical
// value is empty or carries non-identifier bytes.
//
// A user passing `tagSynonyms: { "return": "" }` (or `"my tag"`,
// `"returns!"`, etc.) would otherwise see the fixer emit a malformed
// JSDoc tag like a bare `@`. The rule rejects those entries while
// keeping the rest of the user's synonym table intact, so a single
// typo doesn't poison every JSDoc block in the project.
//
//  1. Configure the rule with a malformed `tagSynonyms` value alongside
//     a valid one.
//  2. Run formatJsdoc on a source containing both candidate tags.
//  3. Assert only the valid synonym fires; the malformed entry leaves
//     its tag alone.
func TestFormatJSDocRejectsMalformedTagSynonymValue(t *testing.T) {
  source := "/** @return number\n * @property name */\nexport const value = 1;\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/jsdoc": SeverityError},
    Options: RuleOptionsMap{
      // `return` → "" is malformed (would emit bare `@`).
      // `property` → "prop" is well-formed and should fire.
      "format/jsdoc": json.RawMessage(`{"tagSynonyms":{"return":"","property":"prop"}}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  // Built-in synonym table still has `@return` → `@returns`, so the
  // malformed override gets dropped and the default value wins.
  // Expect two findings: one for the built-in `return`→`returns`, one
  // for the user `property`→`prop`.
  if len(findings) != 2 {
    t.Fatalf("expected 2 findings (return→returns built-in default + property→prop user override); got %d:\n%v",
      len(findings), findings)
  }
}
