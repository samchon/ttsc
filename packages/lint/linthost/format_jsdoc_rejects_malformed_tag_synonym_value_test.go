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
//  3. Assert the built-in return alias and valid custom property alias
//     both rewrite; malformed overrides must not replace the default.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must reject malformed return overrides while retaining its built-in return-to-returns mapping and the valid property-to-prop entry. The original two-finding assertion remains and complete output prevents duplicated wrong-position findings from satisfying that count.
// @evidence contracts/testing.md#independent-expectations The supported option policy accepts alphabetic canonical tag names and drops invalid overrides without deleting built-ins. Literal returns/prop output and unchanged descriptions independently establish successful recovery.
// @evidence contracts/testing.md#distinguishing-cases The original empty return override stays. Empty, space-containing my tag and punctuation-containing returns! are each paired with a valid custom property alias; every variant requires both the default and valid custom rewrites.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocRejectsMalformedTagSynonymValue owns the original direct Engine assertion and every malformed option/source/output variant in the public Go unit population. The owning rule and edit harness execute in process without consumer installation, native artifact production or a product host.
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
  want := "/** @returns number\n * @prop name */\nexport const value = 1;\n"
  for _, malformed := range []string{"", "my tag", "returns!"} {
    options, err := json.Marshal(map[string]any{"tagSynonyms": map[string]string{
      "return": malformed, "property": "prop",
    }})
    if err != nil {
      t.Fatalf("Marshal options: %v", err)
    }
    assertFixSnapshotWithOptions(t, "format/jsdoc", source, string(options), want)
  }
}
