package linthost

import "testing"

// TestRuleCorpusRequireYield verifies the lint rule corpus fixture require-yield.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in require-yield.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a nonempty generator without yield and permits a generator yielding the same value.
// @evidence contracts/testing.md#independent-expectations The generator-yield policy supplies the authored distinction between returning and suspending with a yielded value.
// @evidence contracts/testing.md#distinguishing-cases Original return-only generator reports; yield 1 remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusRequireYield is selected in the shared Go unit population. It calls assertRuleCorpusCase with require-yield.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusRequireYield(t *testing.T) {
  assertRuleCorpusCase(t, "require-yield.ts", "// expect: require-yield error\nfunction* gen() {\n  return 1;\n}\nJSON.stringify(gen);\n")
  assertRuleSkipsSource(t, "require-yield", "function* gen() { yield 1; }\n")
}
