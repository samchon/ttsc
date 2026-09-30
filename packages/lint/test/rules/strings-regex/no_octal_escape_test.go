package linthost

import "testing"

// TestRuleCorpusNoOctalEscape verifies the lint rule corpus fixture no-octal-escape.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-octal-escape.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the legacy octal string escape while allowing explicit hex and plain NUL escape forms.
// @evidence contracts/testing.md#independent-expectations The authored 251 escape is octal; hex notation and NUL without a following digit are supported alternatives, independently defining the clean oracle.
// @evidence contracts/testing.md#distinguishing-cases Legacy octal, hexadecimal and NUL boundary inputs distinguish numeric escapes rather than banning every backslash.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource executes the newly authored neighboring clean source. Both invocations belong to this discoverable Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoOctalEscape(t *testing.T) {
  assertRuleCorpusCase(t, "no-octal-escape.ts", "// expect: no-octal-escape error\nconst s: string = \"\\251\";\nJSON.stringify(s);")
  assertRuleSkipsSource(t, "no-octal-escape", "const hex = \"\\xA9\";\nconst nul = \"\\0\";\n")
}
