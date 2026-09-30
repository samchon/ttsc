package linthost

import "testing"

// TestRuleCorpusNoOctal verifies the lint rule corpus fixture no-octal.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-octal.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports legacy 010 syntax while accepting explicit 0o10 and decimal zero.
// @evidence contracts/testing.md#independent-expectations Modern ECMAScript has explicit octal notation; the independently authored forms distinguish confusing legacy notation from permitted numeric values.
// @evidence contracts/testing.md#distinguishing-cases Legacy octal, explicit octal and singleton zero cover lexical notation boundaries.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoOctal(t *testing.T) {
  assertRuleCorpusCase(t, "no-octal.ts", "// expect: no-octal error\nconst n = 010;\nJSON.stringify(n);")
  assertRuleSkipsSource(t, "no-octal", "const explicit = 0o10;\nconst zero = 0;\n")
}
