package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDefaultReportsTsNocheckBeforeCode verifies
// typescript/ban-ts-comment reports `@ts-nocheck` ahead of the first statement.
//
// This is the false-negative half of issue #415: the old implementation
// iterated `SourceFile.CommentDirectives`, which never contains the
// nocheck pragma, so a whole-file suppression went unreported. The default
// `ts-nocheck: true` policy must flag it with the generic ban message.
//
// 1. Lint a file opening with `// @ts-nocheck` above real statements.
// 2. Assert exactly one finding with the upstream do-not-use message.
// 3. Assert the finding covers the pragma comment's byte range.
func TestBanTsCommentDefaultReportsTsNocheckBeforeCode(t *testing.T) {
  const message = "Do not use `@ts-nocheck` because it alters compilation errors."
  source := "// @ts-nocheck\nconst a: number = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"typescript/ban-ts-comment": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != message {
    t.Fatalf("message mismatch:\nwant %q\ngot  %q", message, finding.Message)
  }
  if finding.Pos != 0 || finding.End != len("// @ts-nocheck") {
    t.Fatalf("want range [0,%d), got [%d,%d)", len("// @ts-nocheck"), finding.Pos, finding.End)
  }
  if len(finding.Fix) != 0 {
    t.Fatalf("nocheck findings must not carry fixes, got %+v", finding.Fix)
  }
}
