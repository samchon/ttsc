package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeUnaryMinus verifies the lint rule corpus fixture
// typescript-no-unsafe-unary-minus.ts under a real Program.
//
// `typescript/no-unsafe-unary-minus` is type-aware: a parser-only engine run skips
// it because Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by `restrict-plus-operands`: materialize a tsconfig project,
// run `ttsc lint check`, and assert on the rendered diagnostics.
//
// Fixture-shape parity with
// packages/lint/test/testdata/corpus/typescript-no-unsafe-unary-minus.ts is
// enforced by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`-text` where `text: string`) so a future shim regression surfaces here
// without depending on the full fixture.
//
// 1. Seed a project that applies unary `-` to a `string`-typed operand.
// 2. Run `check` with typescript/no-unsafe-unary-minus enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification Unary minus on a string operand must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/no-unsafe-unary-minus rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A number operand supports negation.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeUnaryMinus invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNoUnsafeUnaryMinus(t *testing.T) {
  root := seedLintProject(t, `declare const text: string;
const a = -text;
JSON.stringify(a);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-unary-minus": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-unary-minus]") {
    t.Fatalf("no-unsafe-unary-minus diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unsafe-unary-minus", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unsafe-unary-minus", "declare const value: number;\nconst a = -value;\n")
}
