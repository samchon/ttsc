package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverLineCommentIsNotHazard verifies that a line
// comment between two statements is skipped during hazard detection, so
// the preceding semicolon stays removable.
//
//  1. Parse two statements separated by a line comment.
//  2. Run format/semi configured `prefer: "never"`.
//  3. Assert two findings: a line comment is trivia, never an ASI hazard,
//     so both terminators are strippable.
//  4. Assert the fixed output removes both `;` and keeps the comment
//     intact.
func TestFormatSemiPreferNeverLineCommentIsNotHazard(t *testing.T) {
  const optionsJSON = `{"prefer":"never"}`
  source := "const a = b;\n" +
    "// note\n" +
    "const c = d;\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(optionsJSON),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 2 {
    t.Fatalf("expected 2 findings (the line comment is not a hazard, so both semicolons are removable), got %d:\n%v",
      len(findings), findings)
  }
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    source,
    optionsJSON,
    "const a = b\n// note\nconst c = d\n",
  )
}
