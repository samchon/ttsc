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
//
// @evidence contracts/testing.md#behavioral-verification Engine compares exactly lines nine and ten under allowShortCircuit rather than exempting every logical expression.
// @evidence contracts/testing.md#independent-expectations The option independently requires a productive right operand; count is inert even when run() appears on the left.
// @evidence contracts/testing.md#distinguishing-cases AND/OR/nullish forms ending in calls stay clean; flag && count and run() && count report. The composition test owns nested ternary decisions.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsHonorsAllowShortCircuit is selected in the shared Go unit population. It parses the original source and runs Engine with the authored allowShortCircuit JSON through InlineRuleResolver. No installed consumer, native artifact build or real product host runs.
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
