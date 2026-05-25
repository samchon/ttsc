package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRespectsESLintDisableNextLine verifies that `eslint-disable-next-line`
// suppresses findings on exactly the first non-comment line after the directive.
//
// The directive must not bleed beyond a single target line; if the suppression interval
// were unbounded it would silence every finding that follows. The trailing `-- deliberate
// fixture` text in the directive also exercises the comment-parsing branch that strips
// everything after ` -- `, ensuring optional inline descriptions do not break rule
// extraction.
//
//  1. Parse four lines: one before the directive, the directive itself, one suppressed,
//     one after.
//  2. Run the noVar engine.
//  3. Assert exactly two findings (before and after); the suppressed line is silent.
func TestEngineRespectsESLintDisableNextLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"noVar": SeverityError})
  file := parseTS(t, `
    var before = 1;
    // eslint-disable-next-line noVar -- deliberate fixture
    var skipped = 2;
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
