package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDisableLineMultilineBlockCommentTargetsEndLine verifies that a
// multi-line block-comment `disable-line` suppresses the line where the comment
// ends, not where it starts.
//
// `disable-next-line` keys on the comment's end line (endLine+1), while
// `disable-line` targets the end line itself. A `disable-line` whose `*/` and
// the offending code share that line must suppress that statement, retaining
// the violations on neighboring lines.
//
//  1. Parse four var statements; a multi-line block-comment `disable-line` ends
//     on the same line as the third statement.
//  2. Run the no-var engine.
//  3. Assert exactly three findings; the statement on the comment's end line is
//     suppressed.
//
// @evidence contracts/testing.md#behavioral-verification A multiline disable-line comment suppresses the var statement on its ending line and retains the other three statements.
// @evidence contracts/testing.md#independent-expectations Literal before, middle and after offsets independently identify all three survivors, excluding the ending-line skipped statement.
// @evidence contracts/testing.md#distinguishing-cases The start line, ending-line violation and adjacent statements distinguish comment-start targeting from correct end-line targeting.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineDisableLineMultilineBlockCommentTargetsEndLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    var before = 1;
    var middle = 2;
    /* eslint-disable-line no-var
    */ var skipped = 3;
    var after = 4;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 3 {
    t.Fatalf("want 3 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "var before"), strings.Index(source, "var middle"), strings.Index(source, "var after")}
  for i, pos := range expected {
    finding := findings[i]
    if pos < 0 || finding.File != file || finding.Rule != "no-var" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-var error at %d, got %+v", i, pos, finding)
    }
  }
}
