package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactHooksExhaustiveDepsReportsMissingIdentifiers verifies missing dependency detection.
//
// Dependency checks are intentionally scoped to high-confidence identifier reads in hook callbacks.
// This pins the source-order pass for both effect hooks and memo hooks without requiring type-aware
// closure analysis.
//
// 1. Parse a component with useEffect and useMemo callbacks that read count.
// 2. Enable only react-hooks/exhaustive-deps.
// 3. Assert both empty dependency arrays are reported.
func TestReactHooksExhaustiveDepsReportsMissingIdentifiers(t *testing.T) {
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
    "react-hooks/exhaustive-deps": SeverityWarn,
  }).Run([]*shimast.SourceFile{file}, nil)

  rules := findingRules(findings)
  expected := []string{
    "react-hooks/exhaustive-deps",
    "react-hooks/exhaustive-deps",
  }
  if len(rules) != len(expected) {
    t.Fatalf("want %v, got %v", expected, rules)
  }
  for i := range expected {
    if rules[i] != expected[i] {
      t.Fatalf("rules[%d]: want %q, got %q; all=%v", i, expected[i], rules[i], rules)
    }
  }
}
