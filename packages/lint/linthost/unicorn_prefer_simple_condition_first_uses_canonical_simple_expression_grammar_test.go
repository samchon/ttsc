package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstUsesCanonicalSimpleExpressionGrammar verifies the expression grammar distinguishes simple conditions.
//
// The supported canonical simple-condition grammar independently classifies the literal operands; no product predicate generates the expected matrix.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification The engine evaluates retained simple-expression and nonsimple-expression matrices and checks the appropriate findings.
// @evidence contracts/testing.md#independent-expectations The supported canonical simple-condition grammar independently classifies the literal operands; no product predicate generates the expected matrix.
// @evidence contracts/testing.md#distinguishing-cases Original positive and negative grammar forms remain, including their wrapper and expression-shape boundaries.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstUsesCanonicalSimpleExpressionGrammar owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstUsesCanonicalSimpleExpressionGrammar(t *testing.T) {
  valid := `declare const ready: boolean;
declare const value: unknown;
declare const count: number;
declare const big: bigint;
declare const pattern: RegExp;
declare function check(): boolean;
if (ready && check()) { void 0; }
if (!ready && check()) { void 0; }
if (!!ready && check()) { void 0; }
if (typeof value === "string" && check()) { void 0; }
if (count === +1 && check()) { void 0; }
if (count !== -1 && check()) { void 0; }
if (big === -1n && check()) { void 0; }
if (pattern === /x/ && check()) { void 0; }
if ((ready as boolean) && check()) { void 0; }
if ((<boolean>ready) && check()) { void 0; }
if ((ready satisfies boolean) && check()) { void 0; }
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, valid)

  cases := []struct {
    name   string
    source string
  }{
    {
      name:   "loose equality is complex",
      source: "declare const ready: boolean; declare const value: unknown; declare function check(): boolean; if (check() && value == 1 && ready) { void 0; }",
    },
    {
      name:   "literal-only comparison is complex",
      source: "declare const ready: boolean; declare function check(): boolean; if (check() && 1 === 1 && ready) { void 0; }",
    },
    {
      name:   "template literal is not an ESTree literal",
      source: "declare const ready: boolean; declare const value: unknown; declare function check(): boolean; if (check() && value === `x` && ready) { void 0; }",
    },
    {
      name:   "positive bigint is not a supported signed operand",
      source: "declare const ready: boolean; declare const value: number; declare function check(): boolean; if (check() && value === +(1n as unknown as number) && ready) { void 0; }",
    },
    {
      name:   "property access is complex",
      source: "declare const ready: boolean; declare const value: { ok: boolean }; declare function check(): boolean; if (check() && value.ok && ready) { void 0; }",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, test.source, nil)
      assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      if findings[0].Message != "Consider moving this simple condition first after verifying short-circuit behavior." || len(findings[0].Fix) != 0 {
        t.Fatalf("want unsafe diagnostic without fix, got %+v", findings[0])
      }
    })
  }
}
