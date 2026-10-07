package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveAcceptsTypescriptNamespacePrefix verifies that the
// engine accepts the canonical `typescript/<id>` namespace inside
// `eslint-disable-next-line` directive comments.
//
// `@ttsc/lint` exposes every TypeScript-only rule under `typescript/*`
// (no `@typescript-eslint/*` legacy alias). The directive parser must
// match the canonical name; without that match the suppression silently
// has no effect.
//
//  1. Enable `typescript/no-explicit-any` and parse two lines — one with
//     a `typescript/`-prefixed disable directive, one without.
//  2. Run the engine.
//  3. Assert only the directive-covered line is suppressed; the other
//     line still fires.
//
// @evidence contracts/testing.md#behavioral-verification Canonical typescript/no-explicit-any suppression removes only the first any annotation and retains the second error.
// @evidence contracts/testing.md#independent-expectations The literal any token within the reported declaration independently defines the surviving diagnostic, not just its count.
// @evidence contracts/testing.md#distinguishing-cases Canonical namespace and two annotations distinguish recognized targeted suppression from overbroad suppression; the legacy-prefix test owns the adjacent rejected spelling.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run consume this literal virtual source in one Go process; this selectable entry inspects returned Finding objects, without CLI warning rendering, native compilation or installation.
func TestEngineDirectiveAcceptsTypescriptNamespacePrefix(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  source := `
    // eslint-disable-next-line typescript/no-explicit-any
    const skipped: any = 1;
    const reported: any = 2;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 unsuppressed finding, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "const reported: any") + len("const reported: ")}
  for i, pos := range expected {
    finding := findings[i]
    if finding.File != file || finding.Rule != "typescript/no-explicit-any" || finding.Severity != SeverityError || finding.Pos != pos || finding.End != pos+3 {
      t.Fatalf("finding %d: want canonical any error at [%d,%d), got %+v", i, pos, pos+3, finding)
    }
  }
}
