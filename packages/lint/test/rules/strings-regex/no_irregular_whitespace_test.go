package linthost

import "testing"

// TestRuleCorpusNoIrregularWhitespace verifies the lint rule corpus fixture no-irregular-whitespace.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-irregular-whitespace.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports NBSP separating the binding from its assignment while allowing ASCII spacing.
// @evidence contracts/testing.md#independent-expectations The authored U+00A0 is irregular source whitespace under this policy; an ordinary space is the independent clean control.
// @evidence contracts/testing.md#distinguishing-cases Nonbreaking versus ordinary space differs by one source separator.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoIrregularWhitespace(t *testing.T) {
  assertRuleCorpusCase(t, "no-irregular-whitespace.ts", "// expect: no-irregular-whitespace error\nconst a = 1;\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "no-irregular-whitespace", "const value = 1;\n")
}
