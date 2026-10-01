package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesSkipsTemplateLiterals verifies template literals stay
// untouched by the quote-style formatter.
//
// Template literals use a distinct AST kind (NoSubstitutionTemplateLiteral /
// TemplateExpression). Walking them as part of the StringLiteral kind list
// would silently rewrite backticks to double quotes and strip every
// interpolation. The rule's Visits() list deliberately omits template
// kinds; this scenario pins that omission.
//
// 1. Parse a source file using only backtick template literals.
// 2. Run the engine with formatQuotes enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The engine must emit no quote-style findings for both no-substitution templates and a template expression with a real interpolation.
// @evidence contracts/testing.md#independent-expectations The source literals retain backticks and the ${name} substitution because template grammar is outside the ordinary string-delimiter operation; zero findings is the independent unchanged-source oracle.
// @evidence contracts/testing.md#distinguishing-cases The original two no-substitution literals remain asserted, and the added interpolation exercises TemplateExpression rather than merely claiming it. Ordinary quoted-string positives own actual conversion.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesSkipsTemplateLiterals is a public Go unit selected by TestSelectedLintUnits. This host owns the parsed source fixtures and direct in-process Engine assertions; it starts no consumer install, native product build or product host.
func TestFormatQuotesSkipsTemplateLiterals(t *testing.T) {
  file := parseTS(t, "const greeting = `hello`;\nconst name = `world`;\n")
  findings := NewEngine(RuleConfig{"format/quotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
  interpolated := parseTS(t, "const name = `world`;\nconst greeting = `hello ${name}`;\n")
  interpolatedFindings := NewEngine(RuleConfig{"format/quotes": SeverityError}).Run([]*shimast.SourceFile{interpolated}, nil)
  if len(interpolatedFindings) != 0 {
    t.Fatalf("expected no findings on interpolated template, got %d: %v", len(interpolatedFindings), interpolatedFindings)
  }
}
