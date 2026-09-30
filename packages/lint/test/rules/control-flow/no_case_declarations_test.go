package linthost

import "testing"

// TestRuleCorpusNoCaseDeclarations verifies the lint rule corpus fixture no-case-declarations.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-case-declarations.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports an unscoped case lexical declaration and permits an explicitly scoped case block.
// @evidence contracts/testing.md#independent-expectations Switch clauses share one lexical environment unless a block is introduced; the independently authored braces change that scope boundary.
// @evidence contracts/testing.md#distinguishing-cases The original bare case let reports; the same let inside a case block remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoCaseDeclarations is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-case-declarations.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoCaseDeclarations(t *testing.T) {
  assertRuleCorpusCase(t, "no-case-declarations.ts", "function f(x: number) {\n  switch (x) {\n    case 1:\n      // expect: no-case-declarations error\n      let y = 1;\n      return y;\n  }\n  return 0;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-case-declarations", "switch (value) { case 1: { let y = 1; use(y); break; } }\n")
}
