package linthost

import "testing"

// TestRuleCorpusTripleSlashReferenceViolation verifies the lint rule corpus fixture tripleSlashReference/violation.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in tripleSlashReference/violation.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a triple-slash reference path directive while leaving ordinary commentary alone.
// @evidence contracts/testing.md#independent-expectations The supported triple-slash-reference policy discourages path references; the authored annotation supplies the exact rule/severity/line oracle.
// @evidence contracts/testing.md#distinguishing-cases The path-reference positive is retained with an ordinary comment control, distinct from import-based module references.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated fixture through the engine, and assertRuleSkipsSource owns the authored ordinary-comment control. Both execute under this discoverable Test entry. No consumer install or native product-host build/launch is used.
func TestRuleCorpusTripleSlashReferenceViolation(t *testing.T) {
  assertRuleCorpusCase(t, "tripleSlashReference/violation.ts", "// expect: typescript/triple-slash-reference error\n/// <reference path=\"./other-fixture.d.ts\" />\nconst x = 1;\nJSON.stringify(x);\n")
  assertRuleSkipsSource(t, "typescript/triple-slash-reference", "// ordinary explanation with no compiler directive\nconst value = 1;\nJSON.stringify(value);\n")
}
