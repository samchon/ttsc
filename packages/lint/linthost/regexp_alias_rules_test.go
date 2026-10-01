package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRegexpAliasRulesMirrorBareRegexDiagnostics verifies regexp/* aliases for existing bare regex rules.
//
// Locks the compatibility branch that exposes eslint-plugin-regexp rule names
// without duplicating the older bare ESLint-style rule implementations. The
// aliased rules should report under their `regexp/*` names while reusing the
// same source-text predicates and fixer-safe escape handling.
//
// 1. Parse regex literals that trip the existing control, empty-class, Unicode, and escape checks.
// 2. Enable only the `regexp/*` aliases.
// 3. Assert each diagnostic is reported under the namespaced rule name.
//
// @evidence contracts/testing.md#behavioral-verification Four namespaced regex rules report their own names rather than bare aliases.
// @evidence contracts/testing.md#independent-expectations Literal control, empty class, legacy astral class and useless a escape establish independently authored namespaced line expectations.
// @evidence contracts/testing.md#distinguishing-cases Four distinct alias routes are retained; detailed class/escape negative decisions live in their named semantic units.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngine.Run execute the four authored alias-rule inputs together. This Test compares all normalized namespaced rule/severity/line triples with the independent four-entry list. The calls remain in the lint Go process without consumer installation or a native product-host build/launch.
func TestRegexpAliasRulesMirrorBareRegexDiagnostics(t *testing.T) {
  source := `const control = /\x00/;
const empty = /[]/;
const unicode = /[👍]/;
const escape = /\a/;
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "regexp/no-control-character":            SeverityError,
    "regexp/no-empty-character-class":        SeverityError,
    "regexp/no-misleading-unicode-character": SeverityError,
    "regexp/no-useless-escape":               SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "regexp/no-control-character", Severity: SeverityError, Line: 1},
    {Rule: "regexp/no-empty-character-class", Severity: SeverityError, Line: 2},
    {Rule: "regexp/no-misleading-unicode-character", Severity: SeverityError, Line: 3},
    {Rule: "regexp/no-useless-escape", Severity: SeverityError, Line: 4},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
