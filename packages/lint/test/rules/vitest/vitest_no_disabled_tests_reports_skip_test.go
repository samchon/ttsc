package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoDisabledTestsReportsSkip verifies vitest/no-disabled-tests flags skipped cases.
//
// Skipped tests silently reduce coverage. This confirms the Vitest call-chain
// parser recognizes `.skip` modifiers on normal test declarations.
//
// 1. Parse a test.skip call.
// 2. Enable vitest/no-disabled-tests.
// 3. Assert one diagnostic is emitted.
func TestVitestNoDisabledTestsReportsSkip(t *testing.T) {
  file := parseTS(t, `test.skip("temporarily ignored", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-disabled-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
