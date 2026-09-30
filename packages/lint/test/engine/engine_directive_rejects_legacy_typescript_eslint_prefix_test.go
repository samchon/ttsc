package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveRejectsLegacyTypescriptEslintPrefix verifies that a
// `// eslint-disable-next-line @typescript-eslint/<id>` directive does
// NOT silently suppress a finding from the canonical `typescript/<id>`.
//
// The clean-break migration removed the legacy alias normalization;
// users with stale suppression comments must see their findings fire
// again so the migration cliff is visible. Pairs with
// `TestEngineDirectiveAcceptsTypescriptNamespacePrefix` (which pins the
// positive case) and
// `TestEngineDirectiveRecordsUnknownRuleInUnknownChannel` (which pins
// the user-facing diagnostic for the same unknown name).
//
//  1. Enable `typescript/no-explicit-any`.
//  2. Place a `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
//     above a violation, plus a control violation with no directive.
//  3. Assert BOTH findings still fire — the legacy prefix does not
//     suppress the canonical rule.
//
// @evidence contracts/testing.md#behavioral-verification A legacy @typescript-eslint suppression leaves both canonical typescript/no-explicit-any findings visible.
// @evidence contracts/testing.md#independent-expectations The two authored any token locations and canonical identity independently require both original annotations to report.
// @evidence contracts/testing.md#distinguishing-cases The stale prefix and a directive-free annotation distinguish rejected alias suppression from normal reporting; the canonical-prefix test supplies the accepted spelling.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run consume this literal virtual source in one Go process; this selectable entry inspects returned Finding objects, without CLI warning rendering, native compilation or installation.
func TestEngineDirectiveRejectsLegacyTypescriptEslintPrefix(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  source := `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stillReported: any = 1;
    const alsoReported: any = 2;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 findings (legacy prefix must not suppress), got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "const stillReported: any") + len("const stillReported: "), strings.Index(source, "const alsoReported: any") + len("const alsoReported: ")}
  for i, pos := range expected {
    finding := findings[i]
    if finding.File != file || finding.Rule != "typescript/no-explicit-any" || finding.Severity != SeverityError || finding.Pos != pos || finding.End != pos+3 {
      t.Fatalf("finding %d: want canonical any error at [%d,%d), got %+v", i, pos, pos+3, finding)
    }
  }
}
