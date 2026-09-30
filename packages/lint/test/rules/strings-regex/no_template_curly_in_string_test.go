package linthost

import "testing"

// TestRuleCorpusNoTemplateCurlyInString verifies the lint rule corpus fixture no-template-curly-in-string.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-template-curly-in-string.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports interpolation-shaped text in an ordinary string while permitting a real template interpolation.
// @evidence contracts/testing.md#independent-expectations Ordinary strings do not interpolate ${name}, whereas template syntax does; literal finding and clean expectations follow language syntax.
// @evidence contracts/testing.md#distinguishing-cases Same greeting and name use contrast quoted text with actual interpolation.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoTemplateCurlyInString(t *testing.T) {
  assertRuleCorpusCase(t, "no-template-curly-in-string.ts", "// expect: no-template-curly-in-string error\nconst s: string = \"hello ${name}\";\nJSON.stringify(s);\n")
  assertRuleSkipsSource(t, "no-template-curly-in-string", "const name = \"world\";\nconst value = `hello ${name}`;\n")
}
