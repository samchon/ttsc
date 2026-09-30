package linthost

import "testing"

// TestRuleCorpusPreferForOf verifies the lint rule corpus fixture prefer-for-of.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-for-of.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports an index loop used only to read array elements while permitting a for-of loop.
// @evidence contracts/testing.md#independent-expectations The authored indexed traversal has a direct element iteration alternative; literal marker and already-modern loop zero expectation are independent.
// @evidence contracts/testing.md#distinguishing-cases Index traversal versus for-of separates a migration candidate from the target syntax.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferForOf(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-for-of.ts", "const arr: number[] = [1, 2, 3];\n// expect: prefer-for-of error\nfor (let i = 0; i < arr.length; i++) {\n  console.log(arr[i]);\n}\n")
  assertRuleSkipsSource(t, "prefer-for-of", "const values = [1, 2, 3];\nfor (const value of values) { console.log(value); }\n")
}
