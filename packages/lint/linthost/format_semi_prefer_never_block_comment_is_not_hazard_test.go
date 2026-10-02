package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverBlockCommentIsNotHazard verifies that a block
// comment between two statements is skipped during hazard detection, so
// the preceding semicolon stays removable.
//
//  1. Parse two statements separated by a block comment.
//  2. Run format/semi configured `prefer: "never"`.
//  3. Assert two findings: a block comment is trivia, never an ASI
//     hazard, so both terminators are strippable.
//  4. Assert the fixed output removes both `;` and keeps the comment
//     intact.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must strip both safe declaration terminators across a separate block-comment line while retaining the c comment.
// @evidence contracts/testing.md#independent-expectations The independently authored output preserves a=b and d=e plus the exact block-comment bytes; newline-separated comment trivia does not continue either declaration expression.
// @evidence contracts/testing.md#distinguishing-cases The direct engine asserts two findings and the fixture fixer asserts exact changed output; same-line comments and actual next-expression hazard cases own the complementary retained-terminator decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverBlockCommentIsNotHazard is a public Go unit selected by the lint semantic-unit Evidence claim. This entry parses literal source and directly invokes Engine.Run with the owning semicolon rule; it also uses the syntax-only fixer harness for the exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiPreferNeverBlockCommentIsNotHazard(t *testing.T) {
  const optionsJSON = `{"prefer":"never"}`
  source := "const a = b;\n" +
    "/* c */\n" +
    "const d = e;\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(optionsJSON),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 2 {
    t.Fatalf("expected 2 findings (the block comment is not a hazard, so both semicolons are removable), got %d:\n%v",
      len(findings), findings)
  }
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    source,
    optionsJSON,
    "const a = b\n/* c */\nconst d = e\n",
  )
}
