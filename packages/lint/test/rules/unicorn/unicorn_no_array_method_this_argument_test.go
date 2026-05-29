package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayMethodThisArgument verifies the rule fires
// when an Array iteration method is called with the two-argument
// callback+thisArg shape.
//
// The canonical wrong shape — a non-arrow callback plus a `thisArg`
// object — exercises both the method-name allowlist and the
// exactly-two-arguments gate. Anything wider or narrower (one arg, three
// args) is out of scope by design.
//
// 1. Enable unicorn/no-array-method-this-argument.
// 2. Call `.forEach(fn, ctx)` on an array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoArrayMethodThisArgument(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-method-this-argument.ts", "// expect: unicorn/no-array-method-this-argument error\n[1, 2].forEach(function (x) { console.log(this, x); }, { tag: \"ctx\" });\n")
}
