package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusRequireArraySortCompare verifies an authored typed trigger for
// typescript/require-array-sort-compare under a real Program.
//
// `typescript/require-array-sort-compare` is type-aware: a parser-only engine run
// skips it because Context.Checker is nil. The rule therefore reuses the
// `command_*` shape established by `await-thenable`'s and `no-floating-promises`'s
// tests: materialize a tsconfig project, run `ttsc lint check`, and assert on the
// rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-require-array-sort-compare.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`numbers.sort();`) so a future shim regression surfaces here without
// depending on the full fixture.
//
// 1. Seed a project that declares a number[] and calls .sort() with no args.
// 2. Run `check` with typescript/require-array-sort-compare enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Numeric-array sorting without a comparator must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/require-array-sort-compare rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases An explicit numeric comparator keeps the same array.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusRequireArraySortCompare invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusRequireArraySortCompare(t *testing.T) {
  root := seedLintProject(t, `declare const numbers: number[];
numbers.sort();
`)
  seedLintRules(t, root, map[string]string{"typescript/require-array-sort-compare": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/require-array-sort-compare]") {
    t.Fatalf("require-array-sort-compare diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/require-array-sort-compare", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/require-array-sort-compare", "declare const numbers: number[];\nnumbers.sort((a, b) => a-b);\n")
}
