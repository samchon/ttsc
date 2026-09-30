package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDefaultReportsTsNocheckWithoutStatements verifies
// typescript/ban-ts-comment reports `@ts-nocheck` in a statement-free file.
//
// The first-statement gate must not turn into a blanket skip: when the file
// has no statements at all (upstream's bare `// @ts-nocheck` invalid case)
// the pragma is fully effective and must be reported. This pins the
// `firstStatementLine == -1` branch.
//
// 1. Lint a file containing only the nocheck pragma comment.
// 2. Assert exactly one finding on line 1.
//
// @evidence contracts/testing.md#behavioral-verification Default ban-ts-comment reports nocheck even in a statement-free file.
// @evidence contracts/testing.md#independent-expectations A source-leading pragma does not require a later statement to be effective; the literal directive range is the independent oracle.
// @evidence contracts/testing.md#distinguishing-cases The empty statement population guards against using a first-statement sentinel that incorrectly skips the only directive.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the one-comment file; this Test owns its exact count and span. No consumer install or native product-host build/launch is used.
func TestBanTsCommentDefaultReportsTsNocheckWithoutStatements(t *testing.T) {
  file := parseTS(t, "// @ts-nocheck\n")
  findings := NewEngine(RuleConfig{"typescript/ban-ts-comment": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Pos != 0 || findings[0].End != len("// @ts-nocheck") {
    t.Fatalf("want range [0,%d), got [%d,%d)", len("// @ts-nocheck"), findings[0].Pos, findings[0].End)
  }
}
