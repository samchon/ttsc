package linthost

import "testing"

// TestRuleCorpusPromiseNoPromiseInCallback verifies promise/no-promise-in-callback
// reports promise chains inside error-first callbacks.
//
// The scenario is not returned from the callback, preserving the floating
// promise shape the upstream rule targets.
//
// 1. Enable promise/no-promise-in-callback.
// 2. Create an error-first callback function.
// 3. Assert a promise call inside that callback is reported.
func TestRuleCorpusPromiseNoPromiseInCallback(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-promise-in-callback.ts", "function done(err: Error | null) {\n  if (err) throw err;\n  // expect: promise/no-promise-in-callback error\n  Promise.resolve(1);\n}\n")
}
