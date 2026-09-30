package linthost

import "testing"

// TestRuleCorpusPreferSpread verifies the lint rule corpus fixture prefer-spread.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-spread.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports function apply with an argument tuple while permitting the spread-call spelling.
// @evidence contracts/testing.md#independent-expectations The supported modern call syntax expands the authored args tuple directly; literal old marker and modern-call zero control are independent.
// @evidence contracts/testing.md#distinguishing-cases apply positive and spread-call negative distinguish calling syntax without changing the declared function or tuple.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferSpread(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-spread.ts", "function f(a: number, b: number) {\n  return a + b;\n}\nconst args: [number, number] = [1, 2];\n// expect: prefer-spread error\nf.apply(null, args);\n")
  assertRuleSkipsSource(t, "prefer-spread", "function f(a: number, b: number) { return a + b; }\nconst args: [number, number] = [1, 2];\nf(...args);\n")
}
