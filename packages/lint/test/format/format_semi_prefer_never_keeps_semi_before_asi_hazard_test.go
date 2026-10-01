package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiPreferNeverKeepsSemiBeforeASIHazard verifies the rule
// refuses to strip a trailing `;` when the next statement starts with
// an ASI-hazard token.
//
// `const a = b` followed by `;[1, 2].forEach(…)` parses as two
// statements because of the explicit terminator. Removing the `;`
// would re-associate the `[1, 2]` as a member-access on `b`, changing
// program semantics. The rule's fixer applies to one statement at a
// time and cannot synthesize prettier's defensive leading-`;` on the
// next line, so it conservatively keeps the terminator instead of
// stripping it.
//
//  1. Parse a two-statement source where the second statement starts
//     with `[`.
//  2. Run formatSemi configured `prefer: "never"`.
//  3. Assert exactly one finding, a single-byte removal of the final
//     end-of-file `;` — the hazard guard kept the first `;` in place.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must preserve the terminator before an array-start expression while offering exactly the safe EOF-semicolon removal under never.
// @evidence contracts/testing.md#independent-expectations The independently authored two-statement source makes removal of the first semicolon re-associate the array with one; its final terminator alone has no following hazard, fixing the expected exact edit range.
// @evidence contracts/testing.md#distinguishing-cases One hazardous retained terminator and one safe changed candidate share this fixture; count, format classification and exact sole removal range distinguish the guard from removing the wrong semicolon.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverKeepsSemiBeforeASIHazard is a selected public Go unit under TestSelectedLintUnits. The entry parses literal fixture source and directly calls Engine.Run with the owning semicolon rule, observing its findings and edits in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiPreferNeverKeepsSemiBeforeASIHazard(t *testing.T) {
  source := "const a = 1;\n" +
    "[1, 2].forEach((n) => n);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(`{"prefer":"never"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  // The first statement's `;` is followed by `[`, which would parse
  // as `1[1, 2]` if stripped. The rule must keep that terminator.
  // The second statement's `;` is at end-of-file with no following
  // hazard, so it's the only candidate to strip.
  if len(findings) != 1 {
    t.Fatalf("expected exactly 1 finding (only the trailing-EOF semicolon is safe to strip), got %d:\n%v",
      len(findings), findings)
  }
  if finding := findings[0]; finding.Rule != "format/semi" || !finding.IsFormat || len(finding.Fix) != 1 {
    t.Fatalf("the safe EOF terminator must have one formatter edit: %+v", finding)
  }
  edit := findings[0].Fix[0]
  if edit.Pos != len(source)-2 || edit.End != len(source)-1 || edit.Text != "" {
    t.Fatalf("only the final semicolon may be removed; hazardous first terminator must survive: %+v", edit)
  }
}
