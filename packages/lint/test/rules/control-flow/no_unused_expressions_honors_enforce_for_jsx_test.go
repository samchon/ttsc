package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsHonorsEnforceForJsx verifies no-unused-expressions reports JSX statements under enforceForJSX.
//
// Locks the option-enabled arm of the JSX classification: with
// `enforceForJSX: true`, upstream reports JSX elements, self-closing
// elements, and fragments standing alone as statements while calls that
// consume JSX stay silent. This is the negative twin of the default-mode
// JSX acceptance test.
//
// 1. Parse a TSX file with element, self-closing, fragment, and call statements.
// 2. Run the native Engine with no-unused-expressions configured with enforceForJSX.
// 3. Assert exactly the three bare JSX statements are reported.
func TestNoUnusedExpressionsHonorsEnforceForJsx(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `declare function App(): unknown;
declare function render(node: unknown): void;

<App />;
<div>content</div>;
<></>;
render(<App />);
`
  file := parseTSXFile(t, "/virtual/no-unused-expressions-enforce-jsx.tsx", source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"enforceForJSX":true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: ruleName, Severity: SeverityError, Line: 4},
    {Rule: ruleName, Severity: SeverityError, Line: 5},
    {Rule: ruleName, Severity: SeverityError, Line: 6},
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
