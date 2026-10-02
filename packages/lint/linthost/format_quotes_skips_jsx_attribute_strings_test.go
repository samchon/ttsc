package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesSkipsJsxAttributeStrings verifies that prefer:single formats ordinary strings
// while JSX attribute spelling remains outside this option. Both delimiters
// are valid JSX syntax; JSX quote style has a separate option.
//
// @evidence contracts/testing.md#behavioral-verification The engine must exclude JSX attribute literals from format/quotes while still returning the exact prefer:single edit for an ordinary JavaScript string in the same TSX file.
// @evidence contracts/testing.md#independent-expectations The JSX specification permits both quote delimiters, but JSX spelling belongs to a separate JSX option. The literal expected edit changes only the ordinary foo string to single quotes; its positions exclude the attribute.
// @evidence contracts/testing.md#distinguishing-cases The original attribute-only negative is retained. The paired TSX input adds an adjacent ordinary-string positive with exactly one format/quotes finding and exact replacement, preventing a rule that skips all TSX strings from passing.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesSkipsJsxAttributeStrings is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the parsed source fixtures and direct in-process Engine assertions; it starts no consumer install, native product build or product host.
func TestFormatQuotesSkipsJsxAttributeStrings(t *testing.T) {
  source := "const el = <div className=\"foo\" />;\n"
  file := parseTSXFile(t, "/virtual/main.tsx", source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/quotes": SeverityError},
    Options: RuleOptionsMap{
      "format/quotes": []byte(`{"prefer":"single"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings on JSX attribute string, got %d:\n%v", len(findings), findings)
  }
  paired := "const label = \"foo\";\nconst el = <div className=\"foo\" />;\n"
  pairedFile := parseTSXFile(t, "/virtual/paired.tsx", paired)
  pairedFindings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{pairedFile}, nil)
  if len(pairedFindings) != 1 {
    t.Fatalf("expected only the ordinary JS string to change, got %d: %v", len(pairedFindings), pairedFindings)
  }
  finding := pairedFindings[0]
  if finding.Rule != "format/quotes" || !finding.IsFormat || len(finding.Fix) != 1 {
    t.Fatalf("unexpected ordinary string finding: %+v", finding)
  }
  edit := finding.Fix[0]
  if edit.Pos != len("const label = ") || edit.End != len("const label = \"foo\"") || edit.Text != "'foo'" {
    t.Fatalf("ordinary string edit must exclude JSX attribute: %+v", edit)
  }
}
