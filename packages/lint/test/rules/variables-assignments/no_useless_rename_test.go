package linthost

import "testing"

// TestRuleCorpusNoUselessRename verifies the lint rule corpus fixture no-useless-rename.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-rename.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original foo: foo destructuring rename while permitting a distinct local binding and ordinary shorthand.
// @evidence contracts/testing.md#independent-expectations Redundant renaming requires equal imported/property and local names; the authored annotation distinguishes that from a genuine rename.
// @evidence contracts/testing.md#distinguishing-cases The equal-name original reports; foo: renamed and shorthand foo stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessRename owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoUselessRename(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-rename.ts", "const obj: any = { foo: 1 };\n// expect: no-useless-rename error\nconst { foo: foo } = obj;\nJSON.stringify(foo);\n")
  assertRuleSkipsSource(t, "no-useless-rename", "const obj: any = { foo: 1 }; const { foo: renamed } = obj; const { foo } = obj;\n")
}
