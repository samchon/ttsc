package linthost

import "testing"

// TestRuleCorpusUnicornNoTypeofUndefined verifies unicorn/no-typeof-undefined
// reports `typeof x === "undefined"`.
//
// This fixture pins the strict-equality branch with the typeof on the left and
// the "undefined" literal on the right — the most common shape and the
// canonical positive case for the rule. The match is purely structural, so a
// stand-alone expression statement over `globalThis` is enough to exercise the
// core detection without dragging in declared bindings that would shift the
// expect-annotation target line.
//
// 1. Enable unicorn/no-typeof-undefined via an expect annotation.
// 2. Compare `typeof globalThis === "undefined"` against the literal.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornNoTypeofUndefined(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-typeof-undefined.ts", "// expect: unicorn/no-typeof-undefined error\ntypeof globalThis === \"undefined\";\n")
}
