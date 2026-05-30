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
