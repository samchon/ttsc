package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoIdenticalTitleReportsDuplicateSibling verifies vitest/no-identical-title rejects duplicate sibling names.
//
// Duplicate titles make filtered runs and failure output ambiguous. This pins
// the source-file rule that tracks titles per describe scope.
//
// 1. Parse two sibling tests with the same static title.
// 2. Enable vitest/no-identical-title.
// 3. Assert one diagnostic is emitted for the duplicate.
func TestVitestNoIdenticalTitleReportsDuplicateSibling(t *testing.T) {
  file := parseTS(t, `describe("math", () => {
  test("adds", () => expect(add()).toBe(1));
  test("adds", () => expect(add()).toBe(2));
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-identical-title": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
