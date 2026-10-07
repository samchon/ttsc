package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactExhaustiveDepsReportsMissingIdentifiers verifies missing dependency detection.
//
// Dependency checks are intentionally scoped to high-confidence identifier reads in hook callbacks.
// This pins two missing-dependency reports for effect and memo hooks without requiring type-aware
// closure analysis.
//
// 1. Parse a component with useEffect and useMemo callbacks that read count.
// 2. Enable only react/exhaustive-deps.
// 3. Assert both empty dependency arrays are reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify effect and memo callbacks reading count with empty dependencies both report; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The captured changing count must be represented in the dependency list.
// @evidence contracts/testing.md#distinguishing-cases Two hook kinds own separate captured reads; a callback with count included is added as the accepted control.
// @evidence contracts/testing.md#execution-ownership TestReactExhaustiveDepsReportsMissingIdentifiers is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactExhaustiveDepsReportsMissingIdentifiers(t *testing.T) {
  source := `
function Widget(count: number) {
  useEffect(() => {
    console.log(count);
  }, []);
  const label = useMemo(() => count.toString(), []);
  return label;
}
`
  file := parseTSFile(t, "/virtual/react-hooks-exhaustive-deps.ts", source)
  findings := NewEngine(RuleConfig{
    "react/exhaustive-deps": SeverityWarn,
  }).Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{
    "react/exhaustive-deps": SeverityWarn,
  }, findings); err != nil {
    t.Fatalf("invalid React findings: %v", err)
  }

  rules := findingRules(findings)
  expected := []string{
    "react/exhaustive-deps",
    "react/exhaustive-deps",
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
  assertReactRuleSkips(t, "react/exhaustive-deps", "function Widget(count: number) { useEffect(() => { console.log(count); }, [count]); const label = useMemo(() => count.toString(), [count]); return label; }")
}
