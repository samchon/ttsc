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
func TestRuleCorpusUnicornNoAwaitInPromiseMethods(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-await-in-promise-methods.ts", "async function f() {\n  // expect: unicorn/no-await-in-promise-methods error\n  await Promise.all([await Promise.resolve(1), Promise.resolve(2)]);\n}\n")
}
