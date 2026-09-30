package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessaryAwait verifies
// unicorn/no-unnecessary-await reports `await` applied to a literal
// value that the parser already pins as not-thenable.
//
// Without type information, the rule only fires on syntactic non-promise
// shapes: string/number/bigint/regex/template literals, true/false/null,
// and array/object literals. This fixture pins the numeric-literal case
// so the operand-kind switch stays covered.
//
// 1. Enable unicorn/no-unnecessary-await via an expect annotation.
// 2. Write `await 42` inside an `async function`.
// 3. Assert the await expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies await is applied to a numeric literal; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unnecessary-await annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; await is applied to a promise value. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnnecessaryAwait is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnnecessaryAwait(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-await.ts", "async function f() {\n  // expect: unicorn/no-unnecessary-await error\n  const x = await 42;\n  void x;\n}\nvoid f;\n")
  assertRuleSkipsSource(t, "unicorn/no-unnecessary-await", "async function f() { const x = await Promise.resolve(42); void x; }\n")
}
