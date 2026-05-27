package linthost

import "testing"

// TestRuleCorpusUnicornNoSinglePromiseInPromiseMethods verifies
// unicorn/no-single-promise-in-promise-methods reports a `Promise.all`
// call whose only argument is a one-element array literal.
//
// The match is on the `Promise.<method>` callee plus the single-element
// array-literal argument. The receiver is identifier-text-only, so this
// fixture covers the canonical positive case across the four collection
// methods (`all`/`allSettled`/`race`/`any`).
//
// 1. Enable unicorn/no-single-promise-in-promise-methods via an expect
//    annotation.
// 2. Call `Promise.all([Promise.resolve(1)])` at the top level.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoSinglePromiseInPromiseMethods(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-single-promise-in-promise-methods.ts", "// expect: unicorn/no-single-promise-in-promise-methods error\nconst p = Promise.all([Promise.resolve(1)]);\n")
}
