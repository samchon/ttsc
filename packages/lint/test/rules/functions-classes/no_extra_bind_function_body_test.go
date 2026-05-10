package main

import "testing"

// TestRuleNoExtraBindFunctionBody verifies no-extra-bind inspects function bodies.
//
// The generated corpus covers the arrow-function branch of no-extra-bind. This
// handwritten rule test covers the regular function path where the rule must
// scan the body and prove it does not reference this.
//
// This scenario exists specifically for Go unit coverage of bodyReferencesThis,
// which is not visible through the simpler corpus fixture.
//
// 1. Build a TypeScript fixture with a bound regular function.
// 2. Enable no-extra-bind through the same corpus helper.
// 3. Assert the native Engine reports the annotated diagnostic.
func TestRuleNoExtraBindFunctionBody(t *testing.T) {
	assertRuleCorpusCase(t, "no-extra-bind-function-body.ts", `const obj = {};
// expect: no-extra-bind error
const f = function () { return 1; }.bind(obj);
JSON.stringify(f);
`)
}
