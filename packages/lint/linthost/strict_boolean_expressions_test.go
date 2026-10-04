package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusStrictBooleanExpressions verifies an authored typed trigger for the lint rule
// typescript/strict-boolean-expressions under a real Program.
//
// `typescript/strict-boolean-expressions` is type-aware: a parser-only engine run
// skips it because Context.Checker is nil. This Go scenario therefore reuses the
// `seedLintProject` shape established by `no-misused-promises` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-strict-boolean-expressions.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`if (someNumber)` over a `number`) so a future shim regression surfaces
// here without depending on the full fixture.
//
// 1. Seed a project that places a `number` in an `if` condition.
// 2. Run `check` with typescript/strict-boolean-expressions enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A number condition must report under boolean-only policy.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/strict-boolean-expressions rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A boolean condition is the valid counterpart.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStrictBooleanExpressions invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusStrictBooleanExpressions(t *testing.T) {
  root := seedLintProject(t, `declare const count: number;
if (count) {
  JSON.stringify(count);
}
`)
  seedLintRules(t, root, map[string]string{"typescript/strict-boolean-expressions": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/strict-boolean-expressions]") {
    t.Fatalf("strict-boolean-expressions diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/strict-boolean-expressions", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/strict-boolean-expressions", "declare const flag: boolean;\nif (flag) { JSON.stringify(flag); }\n")
}
