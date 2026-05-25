package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoStandaloneExpectReportsTopLevelExpect verifies vitest/no-standalone-expect rejects module-scope assertions.
//
// Top-level expect calls run during module loading rather than as a test case.
// This locks the callback ancestry check used to keep assertions inside tests
// or hooks.
//
// 1. Parse a module-scope expect call.
// 2. Enable vitest/no-standalone-expect.
// 3. Assert one diagnostic is emitted.
func TestVitestNoStandaloneExpectReportsTopLevelExpect(t *testing.T) {
  file := parseTS(t, `expect(value).toBe(1);
`)
  findings := NewEngine(RuleConfig{"vitest/no-standalone-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
