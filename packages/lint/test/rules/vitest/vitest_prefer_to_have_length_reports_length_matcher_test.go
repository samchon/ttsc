package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestPreferToHaveLengthReportsLengthMatcher verifies vitest/prefer-to-have-length flags .length equality.
//
// Matching `.length` through equality hides the more specific Vitest matcher.
// This pins the matcher-chain recognizer for `expect(value.length).toBe(n)`.
//
// 1. Parse an expect call that asserts on `.length`.
// 2. Enable vitest/prefer-to-have-length.
// 3. Assert one diagnostic is emitted.
func TestVitestPreferToHaveLengthReportsLengthMatcher(t *testing.T) {
  file := parseTS(t, `test("length", () => {
  expect(items.length).toBe(3);
});
`)
  findings := NewEngine(RuleConfig{"vitest/prefer-to-have-length": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
