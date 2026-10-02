package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverKeepsSemiBeforeRegexHazard verifies the rule
// keeps a semicolon when the following line begins with a bare slash,
// because automatic semicolon insertion would otherwise treat it as a
// division/regex continuation of the previous expression.
//
//  1. Parse two statements where the second begins with a regex literal
//     "/re/".
//  2. Run format/semi configured `prefer: "never"`.
//  3. Assert exactly one finding: the hazardous first `;` is kept, while
//     the trailing-EOF `;` (no following hazard) is the only candidate to
//     strip.
//  4. Assert the fixed output retains the hazardous `;` and strips only
//     the safe trailing one.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must preserve the declaration terminator before a slash-leading regex expression and remove the final safe call terminator.
// @evidence contracts/testing.md#independent-expectations The independently authored fixed source retains const a=b as a separate declaration and /re/.test(c) as a regex call; removing the first semicolon would risk expression continuation.
// @evidence contracts/testing.md#distinguishing-cases Direct count-one and exact complete fixed output verify a retained hazardous candidate plus a changed EOF candidate, complementing the bracket-start hazard and trivia-only safe cases.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsSemiBeforeRegexHazard is a public Go unit selected by the lint semantic-unit Evidence claim. This entry parses literal source and directly invokes Engine.Run with the owning semicolon rule; it also uses the syntax-only fixer harness for the exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiPreferNeverKeepsSemiBeforeRegexHazard(t *testing.T) {
  const optionsJSON = `{"prefer":"never"}`
  source := "const a = b;\n" +
    "/re/.test(c);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(optionsJSON),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected exactly 1 finding (the bare-slash hazard keeps the first semicolon; only the trailing-EOF one is safe to strip), got %d:\n%v",
      len(findings), findings)
  }
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    source,
    optionsJSON,
    "const a = b;\n/re/.test(c)\n",
  )
}
