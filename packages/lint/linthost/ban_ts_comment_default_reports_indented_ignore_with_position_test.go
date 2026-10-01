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
//
// @evidence contracts/testing.md#behavioral-verification ban-ts-comment spans the indented ignore comment without consuming surrounding block text or whitespace.
// @evidence contracts/testing.md#independent-expectations The exact authored comment substring determines its source range independently of findings.
// @evidence contracts/testing.md#distinguishing-cases An indented nested block contrasts with column-zero reporting in the upgrade-message case.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the fixture; this Test owns the count and literal-comment offset assertions. No consumer install or native product-host build/launch is used.
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
