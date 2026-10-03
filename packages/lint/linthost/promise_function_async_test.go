package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPromiseFunctionAsync verifies the lint rule corpus fixture
// typescript-promise-function-async.ts under a real Program.
//
// `typescript/promise-function-async` is type-aware: a parser-only engine run skips
// it because Context.Checker is nil. This Go scenario reuses the `seedLintProject`
// shape established by the surrounding async family — materialize a tsconfig
// project, run `ttsc lint check`, and assert on the rendered diagnostics — to lock
// the minimum-viable trigger (a function declaration whose return type is
// `Promise<T>` without the `async` keyword) so a future shim regression surfaces
// here without depending on the full fixture.
//
//  1. Seed a project with a function returning `Promise<number>` that
//     forwards another Promise without being declared `async`.
//  2. Run `check` with typescript/promise-function-async enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Promise-returning implementations lacking async must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/promise-function-async rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases The same Promise-forwarding implementation already async stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseFunctionAsync invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPromiseFunctionAsync(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<number>;
function makePromise(): Promise<number> {
  return getPromise();
}
JSON.stringify(makePromise);
`)
  seedLintRules(t, root, map[string]string{"typescript/promise-function-async": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/promise-function-async]") {
    t.Fatalf("promise-function-async diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/promise-function-async", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/promise-function-async", "declare function getPromise(): Promise<number>;\nasync function makePromise(): Promise<number> { return getPromise(); }\n")
}
