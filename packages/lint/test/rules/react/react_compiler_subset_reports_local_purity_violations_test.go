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
