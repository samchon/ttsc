package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRespectsESLintDisableNextLine verifies that `eslint-disable-next-line`
// suppresses findings on exactly the line immediately after the directive.
//
// The directive must not bleed beyond a single target line; if the suppression interval
// were unbounded it would silence every finding that follows. The trailing `-- deliberate
// fixture` text in the directive also exercises the comment-parsing branch that strips
// everything after ` -- `, ensuring optional inline descriptions do not break rule
// extraction.
//
//  1. Parse four lines: one before the directive, the directive itself, one suppressed,
//     one after.
//  2. Run the no-var engine.
//  3. Assert exactly two findings (before and after); the suppressed line is silent.
//
// @evidence contracts/testing.md#behavioral-verification An eslint-disable-next-line directive with a description suppresses the next var statement, retaining the statements before and after it.
// @evidence contracts/testing.md#independent-expectations Authored before and after statement offsets establish the exact survivors rather than accepting any two diagnostics.
// @evidence contracts/testing.md#distinguishing-cases The description separator, next-line violation and later violation distinguish rule-name extraction, single-line scope and suppression leakage.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineRespectsESLintDisableNextLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    var before = 1;
    // eslint-disable-next-line no-var -- deliberate fixture
    var skipped = 2;
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
