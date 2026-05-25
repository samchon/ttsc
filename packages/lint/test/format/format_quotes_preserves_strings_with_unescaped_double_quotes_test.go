package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesPreservesStringsWithUnescapedDoubleQuotes verifies the
// escape-cost tie-breaker: a single-quoted literal that contains unescaped
// double quotes is left as-is.
//
// Converting `'say "hi"'` to double would add two backslash escapes
// (`"say \"hi\""`) — strictly more characters than the source. Prettier's
// rule (which this implementation mirrors) keeps the original literal in
// that case. This scenario pins the inequality so a future flip of the
// `>` operator cannot silently start adding noise to source.
//
// 1. Parse a source file with single-quoted literals containing `"`.
// 2. Run the engine with formatQuotes enabled.
// 3. Assert zero findings.
func TestFormatQuotesPreservesStringsWithUnescapedDoubleQuotes(t *testing.T) {
  file := parseTS(t, "const greeting = 'say \"hi\"';\nJSON.stringify(greeting);\n")
  findings := NewEngine(RuleConfig{"formatQuotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
