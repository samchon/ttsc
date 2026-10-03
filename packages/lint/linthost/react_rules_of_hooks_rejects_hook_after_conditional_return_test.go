package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactRulesOfHooksRejectsHookAfterConditionalReturn verifies hooks after early returns.
//
// The rules-of-hooks pass used to inspect only ancestors of the hook call. This pins the sibling
// statement branch where an earlier `if` can return before a later top-level hook call executes.
//
// 1. Parse a component that returns null from a conditional guard.
// 2. Call useEffect after the guard.
// 3. Assert react/rules-of-hooks reports the hook as conditional.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify a hook after an earlier conditional return reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Hooks must execute in the same order on every component render path.
// @evidence contracts/testing.md#distinguishing-cases A preceding sibling return can bypass a top-level hook even without a conditional ancestor; an always-reached hook is added as control.
// @evidence contracts/testing.md#execution-ownership TestReactRulesOfHooksRejectsHookAfterConditionalReturn is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactRulesOfHooksRejectsHookAfterConditionalReturn(t *testing.T) {
  source := `
function Widget(props: { hidden: boolean }) {
  if (props.hidden) return null;
  useEffect(() => {}, []);
  return null;
}
`
  file := parseTSFile(t, "/virtual/react-hooks-rules-of-hooks-conditional-return.ts", source)
  findings := NewEngine(RuleConfig{
    "react/rules-of-hooks": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{
    "react/rules-of-hooks": SeverityError,
  }, findings); err != nil {
    t.Fatalf("invalid React findings: %v", err)
  }

  rules := findingRules(findings)
  expected := []string{
    "react/rules-of-hooks",
  }
  if len(rules) != len(expected) {
    t.Fatalf("want %v, got %v", expected, rules)
  }
  for i := range expected {
    if rules[i] != expected[i] {
      t.Fatalf("rules[%d]: want %q, got %q; all=%v", i, expected[i], rules[i], rules)
    }
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertReactRuleSkips(t, "react/rules-of-hooks", "function Widget(props: { hidden: boolean }) { useEffect(() => {}, []); if (props.hidden) return null; return null; }")
}
