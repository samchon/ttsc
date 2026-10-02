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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must strip both safe declaration terminators across a standalone line comment while preserving its note bytes.
// @evidence contracts/testing.md#independent-expectations The independently authored complete output retains a=b, c=d and the line comment; its existing line separators establish safe declaration boundaries independently of the hazard scan.
// @evidence contracts/testing.md#distinguishing-cases The direct engine observes two findings and the fixture fixer requires exact output; regex/bracket-leading next-expression cases complement this trivia-only changed positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverLineCommentIsNotHazard is a public Go unit selected by the lint semantic-unit Evidence claim. This entry parses literal source and directly invokes Engine.Run with the owning semicolon rule; it also uses the syntax-only fixer harness for the exact output in the same Go process, without consumer installation, a native product build or host execution.
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
