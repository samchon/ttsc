package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDefaultReportsIndentedIgnoreWithPosition verifies a
// mid-file, indented `@ts-ignore` reports at the comment's own offset.
//
// Upstream's unreachable-code case pins line 3 column 3: the finding must
// anchor on the comment token, not the enclosing statement or the file
// start. A range derived from the wrong node would break editor
// diagnostics and `// expect:` line pinning alike.
//
// 1. Lint `// @ts-ignore: Unreachable code error` nested in an if block.
// 2. Assert one finding whose range equals the comment's byte range.
func TestBanTsCommentDefaultReportsIndentedIgnoreWithPosition(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const comment = "// @ts-ignore: Unreachable code error"
  source := "if (false) {\n  " + comment + "\n  JSON.stringify(1);\n}\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  offset := strings.Index(source, comment)
  if findings[0].Pos != offset || findings[0].End != offset+len(comment) {
    t.Fatalf("want range [%d,%d), got [%d,%d)",
      offset, offset+len(comment), findings[0].Pos, findings[0].End)
  }
}
