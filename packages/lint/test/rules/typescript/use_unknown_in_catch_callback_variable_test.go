package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusUseUnknownInCatchCallbackVariable verifies the lint rule
// corpus fixture use-unknown-in-catch-callback-variable.ts under a real
// Program.
//
// The rule is type-aware: it confirms the receiver of `.catch` is
// actually a Promise via `ctx.Checker.GetTypeAtLocation`. The
// checker-less AST harness used by `assertRuleCorpusCase` skips it,
// so this test reuses the `command_*` shape: seed a tsconfig project,
// run `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project with `.catch((err) => ...)` lacking the annotation.
// 2. Run `check` with the rule enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification Promise catch callback parameters lacking unknown annotation must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/use-unknown-in-catch-callback-variable rendered error at line 3, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Explicit unknown annotation is the clean callback boundary.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUseUnknownInCatchCallbackVariable invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusUseUnknownInCatchCallbackVariable(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<number>;
declare function sideEffect(): void;
getPromise().catch((err) => {
  sideEffect();
});
`)
  seedLintRules(t, root, map[string]string{
    "typescript/use-unknown-in-catch-callback-variable": "error",
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/use-unknown-in-catch-callback-variable]") {
    t.Fatalf("use-unknown-in-catch-callback-variable diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/use-unknown-in-catch-callback-variable", stderr, 3)
  assertTypedRuleCleanSource(t, "typescript/use-unknown-in-catch-callback-variable", "declare function getPromise(): Promise<number>;\ndeclare function sideEffect(): void;\ngetPromise().catch((err: unknown) => { sideEffect(); });\n")
}
