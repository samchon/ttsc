package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsHonorsAllowTernary verifies no-unused-expressions requires both ternary branches to be productive.
//
// Locks the conditional-expression arm of `noUnusedExpressionsDisallows`:
// upstream exempts `a ? b() : c()` under `allowTernary` only when neither
// result branch is side-effect free — assignments count as productive
// branches. A ternary with one bare-identifier branch stays reported, in
// either branch position.
//
// 1. Parse ternary statements with productive and mixed branches.
// 2. Run the native Engine with no-unused-expressions configured with allowTernary.
// 3. Assert only the ternaries with a side-effect-free branch are reported.
func TestNoUnusedExpressionsHonorsAllowTernary(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `declare function run(): number;
declare function other(): number;
declare const flag: boolean;
declare const count: number;
let sink = 0;

flag ? run() : other();
flag ? (sink = 1) : run();
flag ? run() : count;
flag ? count : other();
`
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"allowTernary":true}`)},
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
