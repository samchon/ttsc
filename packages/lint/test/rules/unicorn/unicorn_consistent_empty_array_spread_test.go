package linthost

import "testing"

// TestRuleCorpusUnicornConsistentEmptyArraySpread verifies the rule
// fires when a spread ternary's branches have inconsistent shapes.
//
// The mismatched-branch case — one array literal, one non-array — is
// the canonical wrong shape. Pinning this fixture locks the
// SpreadElement + ConditionalExpression matcher and the XOR between
// the two branches' array-literal status.
//
// 1. Enable unicorn/consistent-empty-array-spread.
// 2. Inside an array literal, spread `cond ? [x] : <non-array>`.
// 3. Assert the spread element is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies conditional spread substitutes a nonempty non-array false arm; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/consistent-empty-array-spread annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the false arm is the empty array while the true arm remains a singleton. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornConsistentEmptyArraySpread is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornConsistentEmptyArraySpread(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/consistent-empty-array-spread.ts", "declare const cond: boolean;\ndeclare const x: number;\n// expect: unicorn/consistent-empty-array-spread error\nconst a = [1, ...(cond ? [x] : 2 as unknown as number[])];\nvoid a;\n")
  assertRuleSkipsSource(t, "unicorn/consistent-empty-array-spread", "declare const cond: boolean; declare const x: number; const a = [1, ...(cond ? [x] : [])];\n")
}
