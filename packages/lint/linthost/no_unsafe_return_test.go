package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeReturn verifies the lint rule corpus fixture
// typescript-no-unsafe-return.ts under a real Program.
//
// `typescript/no-unsafe-return` is type-aware: a parser-only engine run skips it
// because Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `no-base-to-string` and `restrict-plus-operands`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unsafe-return.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (returning an `any`-typed value from a function whose declared return type is
// `number`) so a future shim regression surfaces here without depending on the full
// fixture.
//
//  1. Seed a project that returns an `any`-typed value from a function
//     declared to return `number`.
//  2. Run `check` with typescript/no-unsafe-return enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Any flowing into a declared number result must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/no-unsafe-return rendered error at line 3, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A number result satisfies the same return contract.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeReturn invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNoUnsafeReturn(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
function asNumber(): number {
  return anyValue;
}
JSON.stringify(asNumber());
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-return": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-return]") {
    t.Fatalf("no-unsafe-return diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unsafe-return", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/no-unsafe-return", "declare const value: number;\nfunction asNumber(): number { return value; }\n")
}
