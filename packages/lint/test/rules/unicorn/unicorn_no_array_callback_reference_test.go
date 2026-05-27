package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayCallbackReference verifies
// unicorn/no-array-callback-reference reports a bare identifier passed
// as the first argument to `Array#filter`.
//
// The rule visits each `CallExpression` and matches a property-access
// callee whose method name is one of the iteration methods, then
// checks whether the first argument is a `KindIdentifier`. The fixture
// passes the named `isEven` predicate directly so the report anchors
// on the identifier inside `.filter(...)`.
//
// 1. Enable unicorn/no-array-callback-reference via an expect annotation.
// 2. Pass a named `isEven` function reference straight to `.filter`.
// 3. Assert the identifier argument is reported.
func TestRuleCorpusUnicornNoArrayCallbackReference(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-array-callback-reference.ts", "function isEven(n: number) { return n % 2 === 0; }\n// expect: unicorn/no-array-callback-reference error\nconst evens = [1, 2, 3].filter(isEven);\n")
}
