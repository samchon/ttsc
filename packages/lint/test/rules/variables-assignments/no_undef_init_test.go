package linthost

import "testing"

// TestRuleCorpusNoUndefInit verifies the lint rule corpus fixture no-undef-init.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-undef-init.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the original explicit undefined initializer without rejecting a declaration with no initializer or a meaningful numeric initializer.
// @evidence contracts/testing.md#independent-expectations Uninitialized mutable bindings already begin undefined; the authored annotation independently identifies the redundant spelling.
// @evidence contracts/testing.md#distinguishing-cases Explicit undefined reports; omitted and non-undefined initializers stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUndefInit owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoUndefInit(t *testing.T) {
  assertRuleCorpusCase(t, "no-undef-init.ts", "// expect: no-undef-init error\nlet a: any = undefined;\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "no-undef-init", "let a: any; let b = 1;\n")
}
