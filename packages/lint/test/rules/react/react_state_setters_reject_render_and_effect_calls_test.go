package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactStateSettersRejectRenderAndEffectCalls verifies state setter placement rules.
//
// The compiler-era React Hooks rules include state-update checks that are useful as AST-local
// linting: setters returned from useState/useReducer should not run during render or synchronously
// inside an effect. This case pins both contexts with one setter binding.
//
// 1. Parse a component that calls one setter in render and one inside useEffect.
// 2. Enable react/set-state-in-render and react/set-state-in-effect.
// 3. Assert each rule reports exactly its own call site.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify render and synchronous effect setter calls each report their own rule; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The state-update context determines whether render or effect policy applies, rather than only the setter name.
// @evidence contracts/testing.md#distinguishing-cases One actual useState setter is reused in both contexts; a deferred event callback is added as the accepted control.
// @evidence contracts/testing.md#execution-ownership TestReactStateSettersRejectRenderAndEffectCalls is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactStateSettersRejectRenderAndEffectCalls(t *testing.T) {
  source := `
function Widget() {
  const [count, setCount] = useState(0);
  setCount(count + 1);
  useEffect(() => {
    setCount(2);
  }, [setCount]);
  return null;
}
`
  file := parseTSFile(t, "/virtual/react-hooks-state-setters.ts", source)
  findings := NewEngine(RuleConfig{
    "react/set-state-in-render": SeverityError,
    "react/set-state-in-effect": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{
    "react/set-state-in-render": SeverityError,
    "react/set-state-in-effect": SeverityError,
  }, findings); err != nil {
    t.Fatalf("invalid React findings: %v", err)
  }

  rules := findingRules(findings)
  expected := []string{
    "react/set-state-in-effect",
    "react/set-state-in-render",
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
  assertReactRuleSkips(t, "react/set-state-in-render", "function Widget() { const [count, setCount] = useState(0); const onClick = () => { setCount(count + 1); }; return onClick; }")
  assertReactRuleSkips(t, "react/set-state-in-effect", "function Widget() { const [count, setCount] = useState(0); const onClick = () => { setCount(count + 1); }; return onClick; }")
}
