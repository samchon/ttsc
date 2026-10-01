package linthost

import (
  "strings"
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
//
// @evidence contracts/testing.md#behavioral-verification Block disable and enable delimit only the middle var statement; the before and after statements remain error findings.
// @evidence contracts/testing.md#independent-expectations The literal before and after statement offsets define the survivors independently of the suppression interval implementation.
// @evidence contracts/testing.md#distinguishing-cases Before, inside and after an open/close pair distinguish overextended suppression, missing disable and missing re-enable.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineRespectsBlockDisableEnable(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    var before = 1;
    /* eslint-disable no-var */
    var skipped = 2;
    /* eslint-enable no-var */
    var after = 3;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "var before"), strings.Index(source, "var after")}
  for i, pos := range expected {
    finding := findings[i]
    if pos < 0 || finding.File != file || finding.Rule != "no-var" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-var error at %d, got %+v", i, pos, finding)
    }
  }
}
