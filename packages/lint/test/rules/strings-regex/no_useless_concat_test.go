package linthost

import "testing"

// TestRuleCorpusNoUselessConcat verifies the lint rule corpus fixture no-useless-concat.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-concat.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports two literal strings concatenated while permitting concatenation with a variable operand.
// @evidence contracts/testing.md#independent-expectations Two literal values can be written as one literal; a variable operand cannot be folded from source alone. Authored expectations retain that policy difference.
// @evidence contracts/testing.md#distinguishing-cases Literal/literal positive and literal/identifier negative distinguish trivial constant concatenation from meaningful composition.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoUselessConcat(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-concat.ts", "// expect: no-useless-concat error\nconst s = \"a\" + \"b\";\nJSON.stringify(s);\n")
  assertRuleSkipsSource(t, "no-useless-concat", "const suffix = \"b\";\nconst value = \"a\" + suffix;\n")
}
