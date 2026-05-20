package linthost

import (
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
func TestEngineRespectsLintDisableNextLineAlias(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  file := parseTS(t, `
    debugger;
    // lint-disable-next-line no-debugger
    debugger;
    debugger;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
