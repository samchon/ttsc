package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryBooleanLiteralCompare verifies a reduced trigger from the lint
// rule corpus fixture typescript-no-unnecessary-boolean-literal-compare.ts
// under a real Program.
//
// `typescript/no-unnecessary-boolean-literal-compare` is type-aware: a parser-only
// engine run skips it because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `strict-boolean-expressions` and
// `no-base-to-string`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unnecessary-boolean-literal-compare.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`flag === true` over a pure boolean) so a future shim regression
// surfaces here without depending on the full fixture.
//
//  1. Seed a project that compares a `boolean` with the `true` literal.
//  2. Run `check` with typescript/no-unnecessary-boolean-literal-compare
//     enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Comparing a boolean with true must report a redundant literal comparison.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-unnecessary-boolean-literal-compare rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases Using the same boolean directly as a condition remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryBooleanLiteralCompare runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoUnnecessaryBooleanLiteralCompare(t *testing.T) {
  root := seedLintProject(t, `declare const flag: boolean;
const yes = flag === true;
JSON.stringify(yes);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-boolean-literal-compare": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-boolean-literal-compare]") {
    t.Fatalf("no-unnecessary-boolean-literal-compare diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unnecessary-boolean-literal-compare", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unnecessary-boolean-literal-compare", "declare const flag: boolean;\nif (flag) { JSON.stringify(flag); }\n")
}
