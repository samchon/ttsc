package linthost

import "testing"

// TestRuleCorpusNoArrayDelete verifies the lint rule corpus fixture no-array-delete.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-array-delete.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification The type-aware rule reports deleting an array index while permitting the same delete syntax on a string-indexed record.
// @evidence contracts/testing.md#independent-expectations Deleting an array slot creates a hole while deleting a record entry removes a mapping; the authored array diagnostic and explicit clean record follow the target type contract.
// @evidence contracts/testing.md#distinguishing-cases The original number-array target reports; a Record target with the same numeric key stays clean, distinguishing Checker-based identity from key syntax.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoArrayDelete owns every assertion and any named table subcases in the shared Go unit population. The source is materialized for the real Program and Checker; it builds no native artifact and starts no product host.
func TestRuleCorpusNoArrayDelete(t *testing.T) {
  assertRuleCorpusCase(t, "no-array-delete.ts", "const arr: number[] = [1, 2, 3];\n// expect: typescript/no-array-delete error\ndelete arr[0];\nJSON.stringify(arr);\n")
  assertRuleSkipsSource(t, "typescript/no-array-delete", "const record: Record<string, number> = { \"0\": 1 }; delete record[0];\n")
}
