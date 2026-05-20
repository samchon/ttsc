package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRespectsBlockDisableEnable verifies that `eslint-disable` / `eslint-enable`
// block comment pairs correctly bracket a suppression region across multiple lines.
//
// The directive interval builder must record distinct open and close events for the same
// rule so that code before the disable and after the enable still fires. Without both
// halves, a disable-only implementation silences everything after the comment, and an
// enable-without-matching-disable would re-open a rule that was never disabled.
// This pins the open/close pairing and the resume-after-enable semantics.
//
// 1. Parse three var statements: one before, one inside, one after a disable/enable pair.
// 2. Run the no-var engine.
// 3. Assert exactly two findings (before and after); the inner statement is suppressed.
func TestEngineRespectsBlockDisableEnable(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var before = 1;
    /* eslint-disable no-var */
    var skipped = 2;
    /* eslint-enable no-var */
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
