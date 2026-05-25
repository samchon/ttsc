package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesSkipsDoubleQuotedLiterals verifies the rule never re-reports
// a double-quoted source literal.
//
// Idempotence is mandatory: any rule whose second pass re-reports its own
// previous edit would spin the format loop until the per-run cap. The
// fastest regression mode here would be a one-character change that ignored
// the raw[0] guard and walked a double-quoted literal as if it were single
// — this scenario pins that guard.
//
// 1. Parse a source file with only double-quoted literals.
// 2. Run the engine with formatQuotes enabled.
// 3. Assert zero findings.
func TestFormatQuotesSkipsDoubleQuotedLiterals(t *testing.T) {
  file := parseTS(t, `const greeting = "hello";`+"\n"+`JSON.stringify(greeting);`+"\n")
  findings := NewEngine(RuleConfig{"formatQuotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
