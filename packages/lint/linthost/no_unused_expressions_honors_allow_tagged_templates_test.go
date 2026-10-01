package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsHonorsAllowTaggedTemplates verifies no-unused-expressions exempts only tagged templates under the option.
//
// Locks the tagged-template arm of `noUnusedExpressionsDisallows`: tagged
// templates are rejected by default (their default rejection is pinned by the
// rule corpus fixtures) and exempted only under `allowTaggedTemplates`,
// because the tag function call may have side effects. An untagged template
// literal stays reported even with the option enabled — its negative twin one
// property away.
//
// 1. Parse a tagged template statement and an untagged template statement.
// 2. Run the native Engine with no-unused-expressions configured with allowTaggedTemplates.
// 3. Assert only the untagged template is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares exactly the plain-template line-four diagnostic under allowTaggedTemplates.
// @evidence contracts/testing.md#independent-expectations The option independently exempts invocation of a tag, not creation of an untagged template literal; the fixed line is authored from that difference.
// @evidence contracts/testing.md#distinguishing-cases Tagged template stays clean under true; plain template reports. The default corpus supplies the otherwise reporting tagged-template counterpart.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsHonorsAllowTaggedTemplates is selected in the shared Go unit population. It parses the original tagged/untagged source and runs Engine through InlineRuleResolver with allowTaggedTemplates true. No installed consumer, native artifact build or real product host runs.
func TestNoUnusedExpressionsHonorsAllowTaggedTemplates(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `declare const tag: (strings: TemplateStringsArray) => string;

tag` + "`value`" + `;
` + "`plain template`" + `;
`
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"allowTaggedTemplates":true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: ruleName, Severity: SeverityError, Line: 4},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
