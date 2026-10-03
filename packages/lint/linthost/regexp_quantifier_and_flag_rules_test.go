package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRegexpQuantifierAndFlagRules verifies source-only regexp quantifier and flag checks.
//
// Pins the first native regexp-family tranche that can be decided from a regex
// literal's pattern and flag text alone. These checks do not inspect dynamic
// `RegExp()` constructor strings, so they remain deterministic AST-only rules.
//
// 1. Parse literals with redundant quantifiers, unsorted flags, and missing Unicode flags.
// 2. Enable the corresponding `regexp/*` rules.
// 3. Assert each rule reports on its own literal line.
//
// @evidence contracts/testing.md#behavioral-verification Ten quantifier/flag rules report their authored positive literal under the exact rule name at line 1.
// @evidence contracts/testing.md#independent-expectations Zero/equal-bound/single/plus/star/question quantifier meanings and flag sorting/Unicode requirements independently determine the literal positive expectation.
// @evidence contracts/testing.md#distinguishing-cases Ten rule-specific inputs retain distinct failure identities through tc.rule; detailed useless i/m negative controls are separate tests.
// @evidence contracts/testing.md#execution-ownership The Test loop calls parseTS and NewEngine.Run once for each literal tc.rule/source pair, compares its authored normalized finding and reports tc.rule on failure; no cases are registered elsewhere. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRegexpQuantifierAndFlagRules(t *testing.T) {
  cases := []struct {
    rule   string
    source string
  }{
    {"regexp/no-zero-quantifier", "const value = /a{0}/;\n"},
    {"regexp/no-useless-two-nums-quantifier", "const value = /a{2,2}/;\n"},
    {"regexp/no-useless-quantifier", "const value = /a{1}/;\n"},
    {"regexp/prefer-plus-quantifier", "const value = /a{1,}/;\n"},
    {"regexp/prefer-star-quantifier", "const value = /a{0,}/;\n"},
    {"regexp/prefer-question-quantifier", "const value = /a{0,1}/;\n"},
    {"regexp/sort-flags", "const value = /a/mi;\n"},
    {"regexp/require-unicode-regexp", "const value = /a/;\n"},
    {"regexp/require-unicode-sets-regexp", "const value = /a/u;\n"},
    {"regexp/no-useless-flag", "const value = /\\d+/i;\n"},
  }
  for _, tc := range cases {
    file := parseTS(t, tc.source)
    findings := NewEngine(RuleConfig{tc.rule: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
    actual := normalizeRuleFindings(file, findings)
    expected := []ruleExpectation{{Rule: tc.rule, Severity: SeverityError, Line: 1}}
    if len(actual) != len(expected) {
      t.Fatalf("%s: want %v, got %v", tc.rule, expected, actual)
    }
    if actual[0] != expected[0] {
      t.Fatalf("%s: want %+v, got %+v; all findings=%+v", tc.rule, expected[0], actual[0], actual)
    }
    recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  }
}
