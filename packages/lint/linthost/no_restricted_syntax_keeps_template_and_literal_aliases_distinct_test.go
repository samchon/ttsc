package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxKeepsTemplateAndLiteralAliasesDistinct verifies a
// no-substitution template literal is a TemplateLiteral and not a Literal.
//
// A backtick expression has template identity even without substitutions.
//
//  1. Parse a source holding a no-substitution template literal.
//  2. Run a Literal selector and a TemplateLiteral selector.
//  3. Assert the Literal selector reports nothing and the TemplateLiteral selector
//     reports the exact range.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires no Literal matches for the original template and one exact TemplateLiteral range.
// @evidence contracts/testing.md#independent-expectations An independently authored backtick expression has template AST identity even without substitution; it is not the supported ordinary Literal alias.
// @evidence contracts/testing.md#distinguishing-cases The same no-substitution template stays clean under Literal and reports under TemplateLiteral.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxKeepsTemplateAndLiteralAliasesDistinct is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxKeepsTemplateAndLiteralAliasesDistinct(t *testing.T) {
  source := "const text = `value`;\nvoid text;\n"
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Literal"`))
  templateSelector := `TemplateLiteral`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+templateSelector+`"`),
    noRestrictedSyntaxExpectation{target: "`value`", message: noRestrictedDefaultMessage(templateSelector)},
  )
}
