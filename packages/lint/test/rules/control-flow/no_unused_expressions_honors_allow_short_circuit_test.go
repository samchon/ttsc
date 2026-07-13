package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsHonorsAllowShortCircuit verifies no-unused-expressions applies allowShortCircuit to the right operand only.
//
// Locks the logical-expression arm of `noUnusedExpressionsDisallows`: upstream
// exempts `a && b()` under `allowShortCircuit` by classifying only the right
// operand — the left operand's value is consumed by the operator itself. All
// three logical operators (`&&`, `||`, `??`) share the arm, and a logical
// expression whose right operand is side-effect free stays reported even when
// its left operand is a call.
//
// 1. Parse logical statements with productive and non-productive right operands.
// 2. Run the native Engine with no-unused-expressions configured with allowShortCircuit.
// 3. Assert only the statements with side-effect-free right operands are reported.
func TestNoUnusedExpressionsHonorsAllowShortCircuit(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `declare function run(): number;
declare const flag: boolean;
declare const fallback: number | undefined;
declare const count: number;

flag && run();
flag || run();
fallback ?? run();
flag && count;
run() && count;
`
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"allowShortCircuit":true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: ruleName, Severity: SeverityError, Line: 9},
    {Rule: ruleName, Severity: SeverityError, Line: 10},
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
