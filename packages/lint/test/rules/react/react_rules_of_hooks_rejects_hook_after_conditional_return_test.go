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
}
