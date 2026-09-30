package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRespectsLintDisableNextLineAlias verifies that the `lint-disable-next-line`
// short-form alias is recognized as an equivalent of `eslint-disable-next-line`.
//
// The directive scanner must match both prefix spellings so users writing project-local
// aliases (without the `eslint-` prefix) get the same suppression behavior. If only the
// `eslint-` prefix is recognized, files using the alias will silently leak findings
// despite having explicit suppression comments.
//
// 1. Parse three debugger statements; the middle one is preceded by `lint-disable-next-line`.
// 2. Run the no-debugger engine.
// 3. Assert exactly two findings; the alias-suppressed statement is silent.
//
// @evidence contracts/testing.md#behavioral-verification The lint-disable-next-line alias suppresses the middle debugger statement while first and last debugger statements remain errors.
// @evidence contracts/testing.md#independent-expectations The first and last literal debugger offsets independently pin survivors despite all three statements having the same text.
// @evidence contracts/testing.md#distinguishing-cases The short alias, covered middle statement and surrounding controls distinguish alias rejection and suppression of the wrong occurrence.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineRespectsLintDisableNextLineAlias(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  source := `
    debugger;
    // lint-disable-next-line no-debugger
    debugger;
    debugger;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "debugger;"), strings.LastIndex(source, "debugger;")}
  for i, pos := range expected {
    finding := findings[i]
    if finding.File != file || finding.Rule != "no-debugger" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-debugger error at %d, got %+v", i, pos, finding)
    }
  }
}
