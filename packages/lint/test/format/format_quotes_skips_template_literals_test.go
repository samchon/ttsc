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
func TestFormatQuotesSkipsTemplateLiterals(t *testing.T) {
  file := parseTS(t, "const greeting = `hello`;\nconst name = `world`;\n")
  findings := NewEngine(RuleConfig{"formatQuotes": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d", len(findings))
  }
}
