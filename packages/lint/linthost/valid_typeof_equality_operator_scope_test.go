package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestValidTypeofEqualityOperatorScope verifies valid-typeof reports only across
// the four equality operators while its comparison-operator peers keep the
// relational ones.
//
// Upstream valid-typeof gates on OPERATORS = {==, ===, !=, !==}: a relational
// comparison orders two strings rather than naming a type, so `typeof x < "m"`
// is not a mistyped type name and ESLint stays silent. This port used to gate on
// the shared isComparisonOperator, which also admits <, >, <= and >=, and
// reported there. Both halves of the fix need pinning: the equality arm must
// still catch every typo shape (either operand order, parentheses, static
// template literal), and use-isnan, no-self-compare, no-compare-neg-zero and
// yoda — whose upstream operator sets do span ordering — must still report on
// relational operators, proving the shared predicate was not narrowed under them.
//
//  1. Wrap the comparison under test as the sole expression of a two-parameter
//     function, so every finding lands on line 2.
//  2. Run the single rule the case names through the native engine.
//  3. Compare normalized rule/severity/line findings against the expectation,
//     requiring zero findings for the arms upstream leaves silent.
//
// @evidence contracts/testing.md#behavioral-verification Twenty named Engine cases compare exact normalized rule/severity/line sets, including zero-finding branches and four other rules retaining ordering operators.
// @evidence contracts/testing.md#independent-expectations Authored table expectations follow the typeof result vocabulary and equality-only valid-typeof policy; NaN, self comparison, negative zero and yoda ordering expectations remain independent peers.
// @evidence contracts/testing.md#distinguishing-cases All four equality operators, reversed operands, parentheses and templates expose typos; known names, ordering comparisons, two typeof operands and unrelated equality remain clean.
// @evidence contracts/testing.md#execution-ownership TestValidTypeofEqualityOperatorScope is selected in the shared Go unit population. Its twenty named subtests parse each source and run the exact per-case RuleConfig through Engine, retaining normalized findings and failure identities. No consumer install, native artifact build or real product host runs.
func TestValidTypeofEqualityOperatorScope(t *testing.T) {
  tests := []struct {
    name       string
    rule       string
    expression string
    wantReport bool
  }{
    {
      name:       "valid-typeof reports a typo behind strict equality",
      rule:       "valid-typeof",
      expression: `typeof x === "stirng"`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo behind loose equality",
      rule:       "valid-typeof",
      expression: `typeof x == "stirng"`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo behind strict inequality",
      rule:       "valid-typeof",
      expression: `typeof x !== "stirng"`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo behind loose inequality",
      rule:       "valid-typeof",
      expression: `typeof x != "stirng"`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo with typeof on the right",
      rule:       "valid-typeof",
      expression: `"stirng" === typeof x`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo through parentheses",
      rule:       "valid-typeof",
      expression: `(typeof x) === ("stirng")`,
      wantReport: true,
    },
    {
      name:       "valid-typeof reports a typo in a static template literal",
      rule:       "valid-typeof",
      expression: "typeof x === `stirng`",
      wantReport: true,
    },
    {
      name:       "valid-typeof accepts a known type string",
      rule:       "valid-typeof",
      expression: `typeof x === "string"`,
    },
    {
      name:       "valid-typeof accepts a known type in a static template literal",
      rule:       "valid-typeof",
      expression: "typeof x === `string`",
    },
    {
      name:       "valid-typeof ignores a less-than comparison",
      rule:       "valid-typeof",
      expression: `typeof x < "m"`,
    },
    {
      name:       "valid-typeof ignores a greater-than-or-equal comparison",
      rule:       "valid-typeof",
      expression: `typeof x >= "z"`,
    },
    {
      name:       "valid-typeof ignores a greater-than comparison with typeof on the right",
      rule:       "valid-typeof",
      expression: `"m" > typeof x`,
    },
    {
      name:       "valid-typeof ignores a less-than-or-equal comparison",
      rule:       "valid-typeof",
      expression: `typeof x <= "stirng"`,
    },
    {
      name:       "valid-typeof ignores a relational comparison against a static template literal",
      rule:       "valid-typeof",
      expression: "typeof x < `stirng`",
    },
    {
      name:       "valid-typeof ignores a comparison between two typeof operands",
      rule:       "valid-typeof",
      expression: `typeof x === typeof y`,
    },
    {
      name:       "valid-typeof ignores an equality comparison without typeof",
      rule:       "valid-typeof",
      expression: `x === "stirng"`,
    },
    {
      name:       "use-isnan still reports a relational NaN comparison",
      rule:       "use-isnan",
      expression: `x < NaN`,
      wantReport: true,
    },
    {
      name:       "no-self-compare still reports a relational self comparison",
      rule:       "no-self-compare",
      expression: `x >= x`,
      wantReport: true,
    },
    {
      name:       "no-compare-neg-zero still reports a relational negative zero comparison",
      rule:       "no-compare-neg-zero",
      expression: `x > -0`,
      wantReport: true,
    },
    {
      name:       "yoda still reports a relational literal-first comparison",
      rule:       "yoda",
      expression: `1 <= x`,
      wantReport: true,
    },
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      source := "function f(x: any, y: any) {\n  return " + test.expression + ";\n}\n"
      file := parseTS(t, source)
      findings := NewEngine(RuleConfig{test.rule: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
      want := []ruleExpectation{}
      if test.wantReport {
        want = append(want, ruleExpectation{Rule: test.rule, Severity: SeverityError, Line: 2})
      }
      got := normalizeRuleFindings(file, findings)
      if len(got) != len(want) {
        t.Fatalf("%s on %q: want %+v, got %+v", test.rule, test.expression, want, got)
      }
      for index := range want {
        if got[index] != want[index] {
          t.Fatalf("%s on %q [%d]: want %+v, got %+v", test.rule, test.expression, index, want[index], got[index])
        }
      }
    })
  }
}
