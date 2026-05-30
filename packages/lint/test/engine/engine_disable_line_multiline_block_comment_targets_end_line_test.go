package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDisableLineMultilineBlockCommentTargetsEndLine verifies that a
// multi-line block-comment `disable-line` suppresses the line where the comment
// ends, not where it starts.
//
// `disable-next-line` keys on the comment's end line (endLine+1), but
// `disable-line` historically keyed on the comment's start line, so a block
// comment that spanned lines suppressed only its first line. This pins the
// parity fix: a `disable-line` whose `*/` and the offending code share the end
// line must suppress that statement.
//
//  1. Parse four var statements; a multi-line block-comment `disable-line` ends
//     on the same line as the third statement.
//  2. Run the no-var engine.
//  3. Assert exactly three findings; the statement on the comment's end line is
//     suppressed.
func TestEngineDisableLineMultilineBlockCommentTargetsEndLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var before = 1;
    var middle = 2;
    /* eslint-disable-line no-var
    */ var skipped = 3;
    var after = 4;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 3 {
    t.Fatalf("want 3 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
