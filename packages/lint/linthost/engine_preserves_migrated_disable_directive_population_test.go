package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEnginePreservesMigratedDisableDirectivePopulation verifies the complete
// inline-disable scenario transferred from the installed lint configuration lane.
//
// Keeps both directive vocabularies, independent rule lists, range reopening
// and a string lookalike in one engine call so separate assertions cannot miss
// interference between the suppression states.
//
// 1. Parse the original ten-line source without changing its input bytes.
// 2. Enable no-var, no-debugger and typescript/no-explicit-any together.
// 3. Require exactly the three authored no-var errors at lines 1, 8 and 10.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run suppresses next-line any/var, same-line var/debugger and block var diagnostics, then reopens no-var after enable while ignoring directive-shaped string text. Exact findings catch both leaked suppression and incorrectly unsuppressed rules.
// @evidence contracts/testing.md#independent-expectations The authored directive syntax independently selects suppressed lines 3, 4 and 6; ordinary vars at lines 1, 8 and 10 must remain errors. Literal rule/severity/line triples are not derived from Engine output.
// @evidence contracts/testing.md#distinguishing-cases Comma-separated multi-rule next-line suppression, lint-disable-line, eslint block disable/enable and string lookalikes share one source. Both forbidden-rule suppression and restored findings retain their original input and failure population.
// @evidence contracts/testing.md#execution-ownership TestEnginePreservesMigratedDisableDirectivePopulation calls parseTS and NewEngine.Run directly in the Go process, then normalizeRuleFindings compares the three literal expectations. This unit owns the complete original source population; the installed consumer survivor separately owns diagnostic transport and exit status. No consumer install, native build or product-host process is required here.
func TestEnginePreservesMigratedDisableDirectivePopulation(t *testing.T) {
  source := "var before = 1;\n// eslint-disable-next-line no-var, typescript/no-explicit-any -- deliberate\nvar skipped: any = 2;\nvar sameLine = 3; debugger; // lint-disable-line no-var, no-debugger\n/* eslint-disable no-var */\nvar blockSkipped = 4;\n/* eslint-enable no-var */\nvar after = 5;\nconst text = \"// eslint-disable-next-line no-var\";\nvar stringNotDirective = 6;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-var":                     SeverityError,
    "no-debugger":                SeverityError,
    "typescript/no-explicit-any": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "no-var", Severity: SeverityError, Line: 1},
    {Rule: "no-var", Severity: SeverityError, Line: 8},
    {Rule: "no-var", Severity: SeverityError, Line: 10},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for index := range expected {
    if actual[index] != expected[index] {
      t.Errorf("finding %d: want %+v, got %+v", index, expected[index], actual[index])
    }
  }
}
