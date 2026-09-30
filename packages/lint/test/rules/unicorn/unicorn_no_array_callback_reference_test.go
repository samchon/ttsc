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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies filter receives a direct callback reference that also receives index and array; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-callback-reference annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; filter adapts the callback with an explicit one-argument arrow. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArrayCallbackReference is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArrayCallbackReference(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-callback-reference.ts", "function isEven(n: number) { return n % 2 === 0; }\n// expect: unicorn/no-array-callback-reference error\nconst evens = [1, 2, 3].filter(isEven);\n")
  assertRuleSkipsSource(t, "unicorn/no-array-callback-reference", "function isEven(n: number) { return n % 2 === 0; } const evens = [1,2,3].filter(x => isEven(x));\n")
}
