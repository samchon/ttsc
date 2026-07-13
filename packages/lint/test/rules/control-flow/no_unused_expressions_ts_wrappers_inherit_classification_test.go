package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsTsWrappersInheritClassification verifies no-unused-expressions recurses through TypeScript wrapper expressions.
//
// Locks the wrapper arms of `noUnusedExpressionsDisallows`: `as`, angle
// assertions, non-null `!`, and instantiation expressions carry no runtime
// effect of their own, so upstream classifies the wrapped expression instead.
// A wrapped identifier stays reported even through nested wrappers, a wrapped
// call stays silent, and `satisfies` is deliberately never reported because
// the upstream Checker map has no TSSatisfiesExpression entry (unknown node
// types are ignored).
//
// 1. Parse wrapper statements around a bare identifier and around a call.
// 2. Run the native Engine with only no-unused-expressions enabled.
// 3. Assert only the identifier-wrapping statements are reported.
func TestNoUnusedExpressionsTsWrappersInheritClassification(t *testing.T) {
  source := `declare function run(): number;
declare function generic<T>(value: T): T;
declare const value: number;

value as unknown;
<unknown>value;
value!;
generic<number>;
(value as unknown)!;
run() as unknown;
<unknown>run();
run()!;
run() satisfies unknown;
value satisfies number;
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"no-unused-expressions": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "no-unused-expressions", Severity: SeverityError, Line: 5},
    {Rule: "no-unused-expressions", Severity: SeverityError, Line: 6},
    {Rule: "no-unused-expressions", Severity: SeverityError, Line: 7},
    {Rule: "no-unused-expressions", Severity: SeverityError, Line: 8},
    {Rule: "no-unused-expressions", Severity: SeverityError, Line: 9},
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
