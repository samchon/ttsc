package linthost

import "testing"

// TestLogicRulesCoverBooleanCallArgumentsUndefinedTypeofNegativeZeroAndNumberNaN
// verifies four ESLint behaviors of the equality and boolean rules that the
// syntax-only versions missed.
//
// `Boolean(!!x)` converts twice; `typeof x === undefined` compares a type name
// with the value undefined; a parenthesized `-0` is still negative zero; and
// `Number.NaN` is NaN. Each has a twin that the same rule must leave alone.
//
//  1. Run no-extra-boolean-cast over `Boolean(!!x)` and `new Boolean(!!x)` and
//     assert each reports, and over `Boolean(x)` and `String(!!x)` and assert
//     nothing is reported.
//  2. Run valid-typeof over `typeof x === undefined` and assert it reports, and
//     over `typeof x === "undefined"` and assert nothing is reported.
//  3. Run no-compare-neg-zero over `x === (-0)` and use-isnan over `x === Number.NaN`
//     and assert each reports, and over `x === 0` and `x === Number.EPSILON` and
//     assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification The four rules must report the Boolean-argument double negation, the undefined identifier compared with typeof, the parenthesized negative zero and Number.NaN, and must keep silent for their ordinary twins.
// @evidence contracts/testing.md#independent-expectations ESLint documents each shape as incorrect: a Boolean call whose argument is already negated twice, typeof compared with the undefined value, a negative-zero comparison however parenthesized, and a comparison with Number.NaN; the authored literal sources are the oracle.
// @evidence contracts/testing.md#distinguishing-cases Each reported source has an adjacent source that differs in one property, a plain argument, a string type name, a plain zero or a different Number constant, so a rule matching only text or only the first form fails one side.
// @evidence contracts/testing.md#execution-ownership TestLogicRulesCoverBooleanCallArgumentsUndefinedTypeofNegativeZeroAndNumberNaN parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestLogicRulesCoverBooleanCallArgumentsUndefinedTypeofNegativeZeroAndNumberNaN(t *testing.T) {
  report := func(rule, source string) {
    t.Helper()
    _, _, findings := runRuleFindingsSnapshot(t, rule, source, nil)
    if len(findings) != 1 {
      t.Fatalf("%s on %q: want exactly one finding, got %d", rule, source, len(findings))
    }
  }
  report("no-extra-boolean-cast", "declare const x: unknown;\nJSON.stringify(Boolean(!!x));\n")
  report("no-extra-boolean-cast", "declare const x: unknown;\nJSON.stringify(new Boolean(!!x));\n")
  assertRuleSkipsSource(t, "no-extra-boolean-cast", "declare const x: unknown;\nJSON.stringify(Boolean(x));\nJSON.stringify(String(!!x));\n")
  report("valid-typeof", "declare const x: unknown;\nJSON.stringify(typeof x === undefined);\n")
  assertRuleSkipsSource(t, "valid-typeof", "declare const x: unknown;\nJSON.stringify(typeof x === \"undefined\");\n")
  report("no-compare-neg-zero", "declare const x: number;\nJSON.stringify(x === (-0));\n")
  assertRuleSkipsSource(t, "no-compare-neg-zero", "declare const x: number;\nJSON.stringify(x === 0);\n")
  report("use-isnan", "declare const x: number;\nJSON.stringify(x === Number.NaN);\n")
  assertRuleSkipsSource(t, "use-isnan", "declare const x: number;\nJSON.stringify(x === Number.EPSILON);\n")
}
