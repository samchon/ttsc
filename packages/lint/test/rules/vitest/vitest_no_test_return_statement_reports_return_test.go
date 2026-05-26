package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoTestReturnStatementReportsReturn verifies vitest/no-test-return-statement flags returned values.
//
// Returning arbitrary values from tests is ignored by Vitest and usually masks
// a missing assertion or await. This locks the direct test-callback detection.
//
// 1. Parse a test callback with a return statement.
// 2. Enable vitest/no-test-return-statement.
// 3. Assert one diagnostic is emitted.
func TestVitestNoTestReturnStatementReportsReturn(t *testing.T) {
  file := parseTS(t, `test("returns", () => {
  return buildValue();
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-test-return-statement": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
