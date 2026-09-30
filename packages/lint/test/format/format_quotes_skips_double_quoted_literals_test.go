package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesSkipsDoubleQuotedLiterals verifies a plain double-quoted hello
// produces no edit under the default double preference. This is a
// zero-escape tie; cost-minimizing cases may change other double-quoted values.
//
// @evidence contracts/testing.md#behavioral-verification The engine must report no quote-style finding for the plain double-quoted hello already canonical under the default preference.
// @evidence contracts/testing.md#independent-expectations The literal hello has zero required escapes under either delimiter, so the supported default-double tie policy independently selects its existing spelling.
// @evidence contracts/testing.md#distinguishing-cases This canonical plain-string negative complements the single-to-double positive; it does not claim that all double-quoted strings are immune, since the strict-cost positive flips one.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesSkipsDoubleQuotedLiterals is a public Go unit selected by TestSelectedLintUnits. This host owns the parsed source fixtures and direct in-process Engine assertions; it starts no consumer install, native product build or product host.
func TestFormatQuotesSkipsDoubleQuotedLiterals(t *testing.T) {
  file := parseTS(t, `const greeting = "hello";`+"\n"+`JSON.stringify(greeting);`+"\n")
  findings := NewEngine(RuleConfig{"format/quotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
