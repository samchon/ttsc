package linthost

import "testing"

// TestRuleCorpusNoPromiseExecutorReturn verifies the lint rule corpus fixture no-promise-executor-return.ts.
//
// The annotated source mirrors packages/lint/test/testdata/corpus/no-promise-executor-return.ts,
// which TestLintFixtureCorpus also executes. This scenario keeps the source
// embedded to drive the checker-backed snapshot helper directly.
//
// The fixture covers concise arrows, block-arrow returns, function-expression executors,
// bare returns, nested function boundaries, and a locally shadowed Promise constructor.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Load a real Program and checker for global Promise binding identity.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed Engine compares exact annotated rule/severity/line triples for concise and explicit executor returns.
// @evidence contracts/testing.md#independent-expectations A genuine global Promise executor must not return a value; bare returns, nested closures and a locally supplied constructor independently fall outside that contract.
// @evidence contracts/testing.md#distinguishing-cases Concise arrow, block arrow and function-expression values report; bare return, nested arrow and shadowed Promise stay clean. The complete/allowVoid tests own scope and option boundaries.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoPromiseExecutorReturn is selected in the shared Go unit population. It calls runRuleFindingsSnapshot with a real Program/Checker for no-promise-executor-return and compares authored annotations. No consumer install, native artifact build or real host runs.
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
