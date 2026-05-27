package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessFallbackInSpread verifies
// unicorn/no-useless-fallback-in-spread reports `...(x ?? {})` inside an
// object literal.
//
// The rule pins both spread node kinds and both fallback operators. This
// fixture is the canonical defensive shape — a nullable value coalesced to
// `{}` and spread — so it exercises both the `SpreadElement` dispatch and
// the `??` branch of the operator switch in one case.
//
// 1. Enable unicorn/no-useless-fallback-in-spread via an expect annotation.
// 2. Spread `x ?? {}` into an object literal where `x` may be `null`.
// 3. Assert the spread element is reported.
func TestRuleCorpusUnicornNoUselessFallbackInSpread(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-useless-fallback-in-spread.ts", "declare const x: { a: number } | null;\n// expect: unicorn/no-useless-fallback-in-spread error\nconst o = { ...(x ?? {}) };\nvoid o;\n")
}
