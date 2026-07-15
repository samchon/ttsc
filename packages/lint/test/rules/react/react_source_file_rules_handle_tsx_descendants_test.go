package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactSourceFileRulesHandleTSXDescendants verifies compiler-era React rules traverse mixed TSX nodes safely.
//
// Source-file rules share one analyzer that visits every descendant. TSX adds
// specialized node payloads that cannot be converted with an unchecked `As*`
// accessor, so collectors must filter by Kind before reading typed payloads.
//
//  1. Parse a component mixing state, refs, nested Hooks, and JSX initializers.
//  2. Enable every React rule that uses the shared source-file analyzer.
//  3. Assert each intended violation is reported at its own node, never as a panic diagnostic.
func TestReactSourceFileRulesHandleTSXDescendants(t *testing.T) {
  source := `
function Component(props: { value: { count: number } }) {
  const [value, setValue] = useState(0);
  const ref = useRef(0);
  const view = <div>{value}</div>;
  props.value.count = 1;
  const current = ref.current;
  setValue(1);
  useEffect(() => {
    setValue(2);
  }, []);
  function useNested() {
    useState(1);
    return null;
  }
  return <section>{view}{current}{useNested()}</section>;
}
`
  file := parseTSXFile(t, "/virtual/react-source-file-rules.tsx", source)
  findings := NewEngine(RuleConfig{
    "react/component-hook-factories": SeverityError,
    "react/immutability":             SeverityError,
    "react/refs":                     SeverityError,
    "react/set-state-in-effect":      SeverityError,
    "react/set-state-in-render":      SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)

  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "react/immutability", Severity: SeverityError, Line: 6},
    {Rule: "react/refs", Severity: SeverityError, Line: 7},
    {Rule: "react/set-state-in-render", Severity: SeverityError, Line: 8},
    {Rule: "react/set-state-in-effect", Severity: SeverityError, Line: 10},
    {Rule: "react/component-hook-factories", Severity: SeverityError, Line: 12},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
  recordExpectedBehavioralWitnesses(t, expected, behavioralWitnessEngine)
}
