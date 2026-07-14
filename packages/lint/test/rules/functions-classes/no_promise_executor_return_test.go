package linthost

import "testing"

// TestRuleCorpusNoPromiseExecutorReturn verifies the lint rule corpus fixture no-promise-executor-return.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// The fixture covers concise arrows, block-arrow returns, function-expression executors,
// bare returns, nested function boundaries, and a locally shadowed Promise constructor.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Load a real Program and checker for global Promise binding identity.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoPromiseExecutorReturn(t *testing.T) {
  source := "declare const condition: boolean;\ndeclare function consume(value: unknown): void;\n\n// expect: no-promise-executor-return error\nnew Promise((resolve) => resolve(1));\n\nnew Promise(() => {\n  if (condition) {\n    // expect: no-promise-executor-return error\n    return 1;\n  }\n  return;\n});\n\nnew Promise(function () {\n  // expect: no-promise-executor-return error\n  return 2;\n});\n\nnew Promise(() => {\n  const nested = () => 3;\n  consume(nested);\n  return;\n});\n\nfunction shadowed(Promise: new (executor: () => unknown) => unknown) {\n  new Promise(() => 4);\n}\nconsume(shadowed);\n"
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, "no-promise-executor-return", source, nil)
  if len(findings) != len(expected) {
    t.Fatalf("no-promise-executor-return.ts: want %v, got %+v", expected, findings)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("no-promise-executor-return.ts[%d]: want %+v, got %+v; all findings=%+v", index, expected[index], actual[index], actual)
    }
  }
}
