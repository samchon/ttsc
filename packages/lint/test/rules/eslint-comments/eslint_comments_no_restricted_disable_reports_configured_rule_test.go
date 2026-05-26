package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoRestrictedDisableReportsConfiguredRule verifies restricted disable detection.
//
// Projects may decide that some diagnostics cannot be waived by inline comments.
// The rule reads its configured rule list and reports disables that name one of
// those protected rules.
//
//  1. Configure `eslint-comments/no-restricted-disable` with `no-var`.
//  2. Parse `eslint-disable-next-line no-var`.
//  3. Assert the restricted disable directive is reported once.
func TestESLintCommentsNoRestrictedDisableReportsConfiguredRule(t *testing.T) {
  file := parseTS(t, `
    // eslint-disable-next-line no-var
    var value = 1;
  `)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{
      "eslint-comments/no-restricted-disable": SeverityError,
    },
    Options: RuleOptionsMap{
      "eslint-comments/no-restricted-disable": json.RawMessage(`{"rules":["no-var"]}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-restricted-disable" {
    t.Fatalf("want one no-restricted-disable finding, got %v", got)
  }
}
