package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeArgument verifies a reduced trigger from the lint rule corpus
// typescript-no-unsafe-argument.ts under a real Program.
//
// The rule uses the Checker to require a non-any callee and inspect each
// argument's type. This entry owns an any argument to an authored number
// parameter; it does not assert resolved-signature or parameter-type filtering.
// With no checker the rule returns, so this Go scenario uses the shared
// `seedLintProject` shape established by `no-floating-promises` and
// `no-for-in-array`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unsafe-argument.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`takesNumber(anyValue)`) so a future shim regression surfaces here without
// depending on the full fixture.
//
// 1. Seed a project that passes an `any` argument to a `number` parameter.
// 2. Run `check` with typescript/no-unsafe-argument enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Any flowing into a concrete number parameter must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/no-unsafe-argument rendered error at line 3, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A number argument satisfies the same parameter.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeArgument invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNoUnsafeArgument(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
declare function takesNumber(value: number): void;
takesNumber(anyValue);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-argument": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-argument]") {
    t.Fatalf("no-unsafe-argument diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unsafe-argument", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/no-unsafe-argument", "declare const value: number;\ndeclare function takesNumber(value: number): void;\ntakesNumber(value);\n")
}
