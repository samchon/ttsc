package linthost

import "testing"

// TestRuleCorpusBanTslintComment verifies the lint rule corpus fixture ban-tslint-comment.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in ban-tslint-comment.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the authored tslint:disable directive rather than ordinary source code.
// @evidence contracts/testing.md#independent-expectations The supported ban-tslint-comment policy rejects legacy TSLint directives; the literal expect annotation supplies rule, severity and line independently.
// @evidence contracts/testing.md#distinguishing-cases This case pins the disable directive; a nearby ordinary comment is retained as a clean control.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated fixture through the engine, and assertRuleSkipsSource owns the authored ordinary-comment control. Both execute under this discoverable Test entry. No consumer install or native product-host build/launch is used.
func TestRuleCorpusBanTslintComment(t *testing.T) {
  assertRuleCorpusCase(t, "ban-tslint-comment.ts", "// expect: typescript/ban-tslint-comment error\n// tslint:disable\nconst x = 1;\nJSON.stringify(x);\n")
  assertRuleSkipsSource(t, "typescript/ban-tslint-comment", "// ordinary explanation with no compiler directive\nconst value = 1;\nJSON.stringify(value);\n")
}
