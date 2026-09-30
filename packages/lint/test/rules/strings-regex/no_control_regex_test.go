package linthost

import "testing"

// TestRuleCorpusNoControlRegex verifies the lint rule corpus fixture no-control-regex.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-control-regex.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the x1f control escape in a regex while allowing an ordinary character pattern.
// @evidence contracts/testing.md#independent-expectations The literal control code belongs to the forbidden ASCII control range; authored expect annotation and ordinary-pattern zero control are independent.
// @evidence contracts/testing.md#distinguishing-cases Control escape versus plain characters isolates control detection.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoControlRegex(t *testing.T) {
  assertRuleCorpusCase(t, "no-control-regex.ts", "// expect: no-control-regex error\nconst r = /\\x1f/;\nJSON.stringify(r);\n")
  assertRuleSkipsSource(t, "no-control-regex", "const re = /abc/;\n")
}
