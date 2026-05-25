package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestReactHooksRulesOfHooksRejectsInvalidCallSites verifies react-hooks/rules-of-hooks invalid call sites.
//
// The first React Hooks rule must be useful without a full ESLint scope graph. This case pins the
// AST-local checks that catch hooks inside conditions, nested callbacks, and non-component helpers
// while leaving dependency analysis to a separate rule.
//
// 1. Parse a component with three invalid hook call locations.
// 2. Enable only react-hooks/rules-of-hooks.
// 3. Assert the engine reports one diagnostic per invalid call.
func TestReactHooksRulesOfHooksRejectsInvalidCallSites(t *testing.T) {
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
    "react-hooks/rules-of-hooks": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)

  rules := findingRules(findings)
  expected := []string{
    "react-hooks/rules-of-hooks",
    "react-hooks/rules-of-hooks",
    "react-hooks/rules-of-hooks",
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
