package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactRulesOfHooksRejectsInvalidCallSites verifies react/rules-of-hooks invalid call sites.
//
// The first React Hooks rule must be useful without a full ESLint scope graph. This case pins the
// AST-local checks that catch hooks inside conditions, nested callbacks, and non-component helpers
// while leaving dependency analysis to a separate rule.
//
// 1. Parse a component with three invalid hook call locations.
// 2. Enable only react/rules-of-hooks.
// 3. Assert the engine reports one diagnostic per invalid call.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify conditional, nested-callback and plain-helper hooks each report; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Only top-level component or custom-hook calls satisfy the hook ordering and ownership contract.
// @evidence contracts/testing.md#distinguishing-cases Three distinct invalid ownership paths remain independently counted; a top-level component hook is added as accepted control.
// @evidence contracts/testing.md#execution-ownership TestReactRulesOfHooksRejectsInvalidCallSites is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactRulesOfHooksRejectsInvalidCallSites(t *testing.T) {
  source := `
function Widget(props: { flag: boolean }) {
  if (props.flag) {
    useEffect(() => {}, []);
  }
  const onClick = () => {
    useState(0);
  };
  return null;
}

function helper() {
  useMemo(() => 1, []);
}
`
  file := parseTSFile(t, "/virtual/react-hooks-rules-of-hooks.ts", source)
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
    "react/rules-of-hooks",
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
  assertReactRuleSkips(t, "react/rules-of-hooks", "function Widget() { useEffect(() => {}, []); return null; }")
}
