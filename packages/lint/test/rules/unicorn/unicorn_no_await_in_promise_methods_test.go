package linthost

import "testing"

// TestRuleCorpusUnicornNoAwaitInPromiseMethods verifies
// unicorn/no-await-in-promise-methods reports an `await` inside the
// array literal passed to `Promise.all`.
//
// The rule visits each `CallExpression`, matches `Promise.<method>`
// for the parallel combinators, and walks the sole array-literal
// argument's elements for any `AwaitExpression`. The fixture wraps
// the call in an `async function` so the inner `await` is legal and
// the report anchors on the offending await element.
//
// 1. Enable unicorn/no-await-in-promise-methods via an expect annotation.
// 2. Pass `[await Promise.resolve(1), Promise.resolve(2)]` to `Promise.all`.
// 3. Assert the inner await is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Promise.all receives an already awaited element; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-await-in-promise-methods annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Promise.all receives both pending promises and performs the single outer await. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoAwaitInPromiseMethods is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoAwaitInPromiseMethods(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-await-in-promise-methods.ts", "async function f() {\n  // expect: unicorn/no-await-in-promise-methods error\n  await Promise.all([await Promise.resolve(1), Promise.resolve(2)]);\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-await-in-promise-methods", "async function f() { await Promise.all([Promise.resolve(1), Promise.resolve(2)]); }\n")
}
