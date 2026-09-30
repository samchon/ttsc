package linthost

import "testing"

// TestRuleCorpusNoEmptyCharacterClass verifies the lint rule corpus fixture no-empty-character-class.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-character-class.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports the authored empty regex class.
// @evidence contracts/testing.md#independent-expectations An empty positive class matches no character; the literal rule/severity/line marker is independent of findings.
// @evidence contracts/testing.md#distinguishing-cases The basic empty positive complements TestNoEmptyCharacterClassUsesParsedClassSemantics for negation, malformed syntax and mode controls.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the embedded annotation fixture through the rule engine. This Test owns every literal expected diagnostic and every unmarked source control. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusNoEmptyCharacterClass(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-character-class.ts", "// expect: no-empty-character-class error\nconst r = /[]/;\nJSON.stringify(r);\n")
}
