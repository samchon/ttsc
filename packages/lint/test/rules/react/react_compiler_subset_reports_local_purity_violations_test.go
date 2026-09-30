package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactCompilerSubsetReportsLocalPurityViolations verifies AST-local compiler-era rules.
//
// Several eslint-plugin-react-hooks 7.x rules are backed by React Compiler analysis upstream. The
// native subset deliberately keeps the first PR to local syntax that is low-risk: prop/state
// mutation, ref.current access during render, nested component factories, and useMemo blocks with no
// return value.
//
// 1. Parse a component containing one violation for each implemented compiler-era subset.
// 2. Enable component-hook-factories, immutability, refs, and use-memo.
// 3. Assert the native Engine reports the expected rule names and counts.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify four distinct reports identify nested hook factory, props mutation, render ref access and missing useMemo return; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations React purity and hook/compiler contracts independently disallow these four authored operations; expected rule identities retain each meaning.
// @evidence contracts/testing.md#distinguishing-cases All four local syntax forms share one component; the source-only subset does not prove whole-program React Compiler equivalence.
// @evidence contracts/testing.md#execution-ownership TestReactCompilerSubsetReportsLocalPurityViolations is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactCompilerSubsetReportsLocalPurityViolations(t *testing.T) {
  source := `
function Widget(props: { item: { count: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  props.item.count = 1;
  ref.current?.focus();
  function Inner() {
    useState(1);
    return null;
  }
  useMemo(() => {
    console.log(props.item);
  }, [props]);
  return Inner;
}
`
  file := parseTSFile(t, "/virtual/react-hooks-compiler-subset.ts", source)
  findings := NewEngine(RuleConfig{
    "react/component-hook-factories": SeverityError,
    "react/immutability":             SeverityError,
    "react/refs":                     SeverityError,
    "react/use-memo":                 SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{
    "react/component-hook-factories": SeverityError,
    "react/immutability":             SeverityError,
    "react/refs":                     SeverityError,
    "react/use-memo":                 SeverityError,
  }, findings); err != nil {
    t.Fatalf("invalid React findings: %v", err)
  }

  rules := findingRules(findings)
  expected := []string{
    "react/component-hook-factories",
    "react/immutability",
    "react/refs",
    "react/use-memo",
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
