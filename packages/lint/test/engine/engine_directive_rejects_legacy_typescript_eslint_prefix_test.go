package linthost

import (
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
func TestEngineDirectiveRejectsLegacyTypescriptEslintPrefix(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  file := parseTS(t, `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stillReported: any = 1;
    const alsoReported: any = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 findings (legacy prefix must not suppress), got %d: %v", got, findingRules(findings))
  }
}
