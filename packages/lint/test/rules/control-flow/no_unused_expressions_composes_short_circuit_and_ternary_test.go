package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsComposesShortCircuitAndTernary verifies no-unused-expressions recurses through nested allowances.
//
// Locks the recursive structure of `noUnusedExpressionsDisallows`: the
// upstream Checker re-enters itself for logical right operands and ternary
// branches, so with both `allowShortCircuit` and `allowTernary` enabled a
// ternary nested inside a logical (and vice versa) is exempt as long as every
// classified position bottoms out in a productive expression. One
// side-effect-free leaf anywhere in a classified position keeps the whole
// statement reported.
//
// 1. Parse statements nesting ternaries inside logicals and logicals inside ternaries.
// 2. Run the native Engine with both allowances enabled.
// 3. Assert only the statement with a bare-identifier leaf is reported.
func TestNoUnusedExpressionsComposesShortCircuitAndTernary(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `declare function run(): number;
declare function other(): number;
declare const flag: boolean;
declare const ready: boolean;
declare const count: number;

flag && (ready ? run() : other());
flag ? run() : (ready && other());
flag ? (ready && count) : other();
`
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{
      ruleName: json.RawMessage(`{"allowShortCircuit":true,"allowTernary":true}`),
    },
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: ruleName, Severity: SeverityError, Line: 9},
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
