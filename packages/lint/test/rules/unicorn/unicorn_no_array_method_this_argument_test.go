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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies forEach receives its optional second this-binding argument; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-method-this-argument annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the original function callback has no second argument, and an arrow callback is also accepted. All three source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArrayMethodThisArgument is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArrayMethodThisArgument(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-method-this-argument.ts", "// expect: unicorn/no-array-method-this-argument error\n[1, 2].forEach(function (x) { console.log(this, x); }, { tag: \"ctx\" });\n")
  assertRuleSkipsSource(t, "unicorn/no-array-method-this-argument", "[1, 2].forEach(function (x) { console.log(this, x); });\n")
  assertRuleSkipsSource(t, "unicorn/no-array-method-this-argument", "[1, 2].forEach(x => { console.log(x); });\n")
}
