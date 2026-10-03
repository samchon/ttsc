package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnsafeCall verifies the lint rule corpus fixture
// typescript-no-unsafe-call.ts under a real Program.
//
// `typescript/no-unsafe-call` is type-aware: it asks the Checker for the callee's
// static type at each `CallExpression`, `NewExpression`, and
// `TaggedTemplateExpression`, and flags invocations on an `any` value. A
// parser-only engine run skips the rule because Context.Checker is nil, so this Go
// scenario reuses the `seedLintProject` shape established by `no-floating-promises`
// and `no-for-in-array`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-no-unsafe-call.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`anyValue()`) so a future shim regression surfaces here without depending on the
// full fixture.
//
// 1. Seed a project that calls an `any`-typed value as a function.
// 2. Run `check` with typescript/no-unsafe-call enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Invoking an any callee must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/no-unsafe-call rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases A callable signature supports the same invocation.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeCall invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusNoUnsafeCall(t *testing.T) {
  root := seedLintProject(t, `declare const anyValue: any;
anyValue();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unsafe-call": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unsafe-call]") {
    t.Fatalf("no-unsafe-call diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unsafe-call", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unsafe-call", "declare const callable: () => void;\ncallable();\n")
}
