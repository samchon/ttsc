package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryCondition verifies the lint rule corpus
// fixture typescript-no-unnecessary-condition.ts under a real Program.
//
// `typescript/no-unnecessary-condition` is type-aware: a parser-only engine run
// skips it because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `strict-boolean-expressions` and
// `switch-exhaustiveness-check`: materialize a tsconfig project, run `ttsc lint
// check`, and assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unnecessary-condition.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`if (obj)` over a non-nullable object type) so a future shim regression
// surfaces here without depending on the full fixture.
//
//  1. Seed a project that places a non-nullable `{ value: number }`
//     object in an `if` condition.
//  2. Run `check` with typescript/no-unnecessary-condition enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A nonnullable object condition must report as always truthy.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-unnecessary-condition rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases A boolean that can be false remains a meaningful condition.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryCondition runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoUnnecessaryCondition(t *testing.T) {
  root := seedLintProject(t, `declare const obj: { value: number };
if (obj) {
  JSON.stringify(obj);
}
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-condition": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-condition]") {
    t.Fatalf("no-unnecessary-condition diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unnecessary-condition", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unnecessary-condition", "declare const flag: boolean;\nif (flag) { JSON.stringify(flag); }\n")
}
