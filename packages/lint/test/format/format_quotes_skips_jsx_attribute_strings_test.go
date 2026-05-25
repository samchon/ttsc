package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesSkipsJsxAttributeStrings verifies JSX attribute string
// initializers stay untouched by the quote-style formatter, regardless of
// prefer:"single" / prefer:"double".
//
// JSX attribute initializers parse as plain StringLiteral nodes, so a
// rule that visits KindStringLiteral and applies prefer:"single" would
// rewrite `<div className="foo" />` to `<div className='foo' />`. The
// JSX grammar canonicalizes attribute values to double quotes and
// prettier exposes a separate `jsxSingleQuote` option for that surface;
// rewriting attributes via `prefer:"single"` corrupts the working
// double-quote form. This scenario pins the JSX-parent guard.
//
// 1. Parse a TSX file with a JSX attribute carrying a double-quoted string.
// 2. Run the engine with formatQuotes configured prefer:"single".
// 3. Assert zero findings.
func TestFormatQuotesSkipsJsxAttributeStrings(t *testing.T) {
  source := "const el = <div className=\"foo\" />;\n"
  file := parseTSXFile(t, "/virtual/main.tsx", source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"formatQuotes": SeverityError},
    Options: RuleOptionsMap{
      "formatQuotes": []byte(`{"prefer":"single"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings on JSX attribute string, got %d:\n%v", len(findings), findings)
  }
}
