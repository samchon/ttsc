package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsEmptyLists verifies the rule shrugs at empty
// lists.
//
// `function noop() {}` and `const empty = []` have no last element, so the
// trailing-comma question is undefined. The branch that early-returns on
// `len(list.Nodes) == 0` is the only thing standing between the rule and a
// nil-deref panic on these shapes. This scenario locks that guard.
//
// 1. Parse empty function declarations, calls, and array literals.
// 2. Run the engine with formatTrailingComma enabled.
// 3. Assert zero findings.
func TestFormatTrailingCommaSkipsEmptyLists(t *testing.T) {
  source := "function noop() {}\nfunction nullary(\n) {\n}\nconst empty = [];\nconst arr = [\n];\nconst obj = {};\nJSON.stringify();\nnew Date();\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
