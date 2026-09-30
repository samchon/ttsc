package linthost

import "testing"

// TestRuleCorpusUnicornPreferReflectApply verifies
// unicorn/prefer-reflect-apply reports the `Function.prototype.apply.call(…)`
// invocation chain.
//
// The rule recognizes the callsite by textual identity of the callee
// expression against the literal chain `Function.prototype.apply.call`.
// This fixture pins the canonical positive case so the text-equality
// match isn't loosened to allow false positives like `Foo.apply.call`.
//
// 1. Enable unicorn/prefer-reflect-apply via an expect annotation.
// 2. Call `Function.prototype.apply.call(f, null, [1, 2])`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Function.prototype.apply.call indirectly invokes a function; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-reflect-apply annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Reflect.apply invokes the same function with the same receiver and arguments. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferReflectApply is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferReflectApply(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-reflect-apply.ts", "function f(a: number, b: number) { return a + b; }\n// expect: unicorn/prefer-reflect-apply error\nconst r = Function.prototype.apply.call(f, null, [1, 2]);\nvoid r;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-reflect-apply", "function f(a:number,b:number) { return a+b; } const r = Reflect.apply(f,null,[1,2]);\n")
}
