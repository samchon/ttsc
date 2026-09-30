package linthost

import "testing"

// TestRuleCorpusNoMultiStr verifies the lint rule corpus fixture no-multi-str.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-multi-str.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports a backslash-continuation string while accepting an ordinary single-line string.
// @evidence contracts/testing.md#independent-expectations The literal source continuation crosses a physical line; normal literal source does not. Expected annotated line is authored independently.
// @evidence contracts/testing.md#distinguishing-cases Physical line continuation is the positive; a plain string is an adjacent negative rather than merely a different declaration kind.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoMultiStr(t *testing.T) {
  assertRuleCorpusCase(t, "no-multi-str.ts", "const s: string =\n  // expect: no-multi-str error\n  \"line1 \\\nline2\";\nJSON.stringify(s);\n")
  assertRuleSkipsSource(t, "no-multi-str", "const value = \"single line\";\n")
}
