package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferFind verifies the lint rule corpus fixture
// typescript-prefer-find.ts under a real Program.
//
// `typescript/prefer-find` is type-aware: a parser-only engine run skips it because
// Context.Checker is nil. This Go scenario therefore reuses the `seedLintProject`
// shape established by `prefer-includes` and `no-for-in-array`: materialize a
// tsconfig project, run `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// packages/lint/test/testdata/corpus/typescript-prefer-find.ts is enforced by
// TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`arr.filter(p)[0]` on a `string[]`) so a future shim regression surfaces here
// without depending on the full fixture.
//
//  1. Seed a project that indexes `[0]` into `arr.filter(p)` on a
//     `string[]`.
//  2. Run `check` with typescript/prefer-find enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification Indexing the first filtered element must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/prefer-find rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Direct find keeps the same predicate.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferFind invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPreferFind(t *testing.T) {
  root := seedLintProject(t, `declare const arr: string[];
const first = arr.filter((s) => s.length > 0)[0];
JSON.stringify(first);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-find": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-find]") {
    t.Fatalf("prefer-find diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/prefer-find", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/prefer-find", "declare const arr: string[];\nconst first = arr.find(s => s.length > 0);\n")
}
