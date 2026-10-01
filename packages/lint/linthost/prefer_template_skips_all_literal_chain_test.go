package linthost

import "testing"

// TestPreferTemplateSkipsAllLiteralChain verifies the rule stays silent
// on a chain of nothing but string literals: `"a" + "b"`.
//
// All-literal concatenation is `no-useless-concat` territory — upstream
// prefer-template only fires when a non-literal operand is mixed in, so
// this chain must produce zero findings rather than an “ `ab` “
// rewrite. Pins the `hasOther` half of the detection gate against the
// flattening changes in the fixer.
//
// 1. Feed an all-string-literal `+` chain to the rule.
// 2. Assert prefer-template reports no findings at all.
//
// @evidence contracts/testing.md#behavioral-verification Prefer-template leaves literal-only concatenation alone.
// @evidence contracts/testing.md#independent-expectations Without a dynamic operand, no-useless-concat owns the simplification rather than template migration; zero findings follows that responsibility.
// @evidence contracts/testing.md#distinguishing-cases All-literal negative complements the dynamic greeting corpus and no-useless-concat positive.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's authored source through the enabled engine rule and owns its zero-finding expectation. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestPreferTemplateSkipsAllLiteralChain(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-template",
    "const s = \"a\" + \"b\";\nJSON.stringify(s);\n",
  )
}
