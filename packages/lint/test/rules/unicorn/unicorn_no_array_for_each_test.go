package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayForEach verifies unicorn/no-array-for-each
// reports a direct `.forEach(...)` call on an array literal.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name; the receiver is not type-checked,
// so the array-literal receiver here is enough to exercise the only
// branch the rule has.
//
// 1. Enable unicorn/no-array-for-each via an expect annotation.
// 2. Call `.forEach` on an inline array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies forEach drives a side-effect-only traversal; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-for-each annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a for-of loop retains the per-element side effect. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArrayForEach is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArrayForEach(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-for-each.ts", "// expect: unicorn/no-array-for-each error\n[1, 2, 3].forEach((x) => { console.log(x); });\n")
  assertRuleSkipsSource(t, "unicorn/no-array-for-each", "for (const x of [1, 2, 3]) { console.log(x); }\n")
}
