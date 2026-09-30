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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an object spread uses an empty-object nullish fallback; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-fallback-in-spread annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; object spread receives the nullable value directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessFallbackInSpread is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessFallbackInSpread(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-fallback-in-spread.ts", "declare const x: { a: number } | null;\n// expect: unicorn/no-useless-fallback-in-spread error\nconst o = { ...(x ?? {}) };\nvoid o;\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-fallback-in-spread", "declare const x: { a: number } | null; const o = { ...x };\n")
}
