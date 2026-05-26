package linthost

import "testing"

// TestRuleCorpusPromiseNoCallbackInPromise verifies promise/no-callback-in-promise
// reports callback calls inside promise handlers.
//
// The callback names mirror eslint-plugin-promise's common callback blacklist.
//
// 1. Declare a callback-shaped function name.
// 2. Call it inside a then handler.
// 3. Assert the callback call is reported.
func TestRuleCorpusPromiseNoCallbackInPromise(t *testing.T) {
	assertRuleCorpusCase(t, "promise/no-callback-in-promise.ts", "declare const cb: () => void;\nPromise.resolve(1).then(() => {\n  // expect: promise/no-callback-in-promise error\n  cb();\n});\n")
}
