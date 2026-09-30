package linthost

import "testing"

// TestRuleCorpusConsistentTypeImportsViolation verifies the lint rule corpus fixture consistentTypeImports/violation.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in consistentTypeImports/violation.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a value-form named Foo import used only as a type, and permits an already type-only import and a runtime value use.
// @evidence contracts/testing.md#independent-expectations Type-only usage should use import type, while existing type syntax and actual runtime use satisfy the rule without changes. The annotated Foo declaration is the literal diagnostic oracle.
// @evidence contracts/testing.md#distinguishing-cases The original Foo type-reference finding is retained; adjacent type-only and runtime import controls distinguish blanket import reporting.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the original annotated Foo fixture through the engine, then runRuleFindingsSnapshot executes the authored type-only/runtime controls. This Test owns both the exact original finding and the clean result in the Go process.
func TestRuleCorpusConsistentTypeImportsViolation(t *testing.T) {
  assertRuleCorpusCase(t, "consistentTypeImports/violation.ts", "// expect: typescript/consistent-type-imports error\nimport { Foo } from \"./types-fixture\";\nconst x: Foo | null = null;\nJSON.stringify(x);\n")
  _, _, clean := runRuleFindingsSnapshot(t, "typescript/consistent-type-imports", "import type { Foo } from \"./types-fixture\";\nconst x: Foo | null = null;\nimport { value } from \"./values\";\nconsole.log(value);\n", nil)
  if len(clean) != 0 {
    t.Fatalf("supported neighboring import/module forms were reported: %+v", clean)
  }
}
