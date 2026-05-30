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
