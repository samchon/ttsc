package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesPreservesStringsWithUnescapedDoubleQuotes verifies the
// strict escape-cost comparison: a single-quoted literal that contains unescaped
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
//
// @evidence contracts/testing.md#behavioral-verification The engine must emit no quote-style finding for the single-quoted say "hi" literal because conversion would introduce two escapes.
// @evidence contracts/testing.md#independent-expectations The parsed literal has the cooked say "hi" payload and no required escapes with its current delimiter; the supported escape-minimization policy makes its existing form the independent negative oracle.
// @evidence contracts/testing.md#distinguishing-cases This strict-cost negative preserves the declaration and call by reporting no edits; the mixed tie and plain-string positives distinguish it from unconditional abstention.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesPreservesStringsWithUnescapedDoubleQuotes is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the parsed source fixtures and direct in-process Engine assertions; it starts no consumer install, native product build or product host.
func TestFormatQuotesPreservesStringsWithUnescapedDoubleQuotes(t *testing.T) {
  file := parseTS(t, "const greeting = 'say \"hi\"';\nJSON.stringify(greeting);\n")
  findings := NewEngine(RuleConfig{"format/quotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
