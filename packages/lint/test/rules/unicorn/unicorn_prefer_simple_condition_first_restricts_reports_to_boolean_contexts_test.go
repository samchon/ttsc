package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstRestrictsReportsToBooleanContexts verifies ordering suggestions stay within boolean contexts.
//
// JavaScript short-circuit operators return operand values outside boolean contexts; the supported rule scope independently requires those value uses to remain unchanged.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run compares retained boolean-context and value-producing uses, rejecting reports in contexts where reordering can alter the returned value.
// @evidence contracts/testing.md#independent-expectations JavaScript short-circuit operators return operand values outside boolean contexts; the supported rule scope independently requires those value uses to remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases Retained boolean conditions report while nonboolean value contexts stay clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstRestrictsReportsToBooleanContexts owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstRestrictsReportsToBooleanContexts(t *testing.T) {
  ignored := `declare const ready: boolean;
declare function check(): boolean;
declare function consume(value: unknown): void;
const assigned = check() && ready;
consume(check() && ready);
const tuple = [check() && ready];
const optionalCast = Boolean?.(check() && ready);
const assertedCast = (Boolean as (value: unknown) => boolean)(check() && ready);
function value() { return check() && ready; }
void assigned;
void tuple;
void optionalCast;
void assertedCast;
void value;
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, ignored)

  contexts := []struct {
    name   string
    source string
  }{
    {"if", "if (check() && ready) { void 0; }"},
    {"while", "while (check() && ready) { break; }"},
    {"do while", "do { void 0; } while (check() && ready);"},
    {"for", "for (; check() && ready;) { break; }"},
    {"ternary test", "const value = check() && ready ? 1 : 0; void value;"},
    {"logical negation", "const value = !(check() && ready); void value;"},
    {"nested logical context", "if (other || (check() && ready)) { void 0; }"},
    {"global Boolean", "const value = Boolean(check() && ready); void value;"},
  }
  declarations := "declare const ready: boolean; declare const other: boolean; declare function check(): boolean; "
  for _, test := range contexts {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, declarations+test.source, nil)
      assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
    })
  }

  shadowed := `declare const ready: boolean;
declare function check(): boolean;
function convert(Boolean: (value: unknown) => boolean) {
  return Boolean(check() && ready);
}
void convert;
`
  assertRuleSkipsSource(t, preferSimpleConditionFirstRule, shadowed)
}
