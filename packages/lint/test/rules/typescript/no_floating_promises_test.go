package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoFloatingPromises verifies the lint rule corpus fixture
// no-floating-promises.ts under a real Program.
//
// `typescript/no-floating-promises` is type-aware: a parser-only engine run skips
// it because Context.Checker is nil. The rule therefore uses the command-test shape
// for type-aware rules: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
// Fixture-shape parity with
// packages/lint/test/testdata/corpus/no-floating-promises.ts is enforced by
// TestLintFixtureCorpus; this Go scenario locks the minimum-viable trigger
// (`getPromise();`) so a future shim regression surfaces here without depending on
// the full fixture.
//
// 1. Seed a project that defines getPromise() and discards its return.
// 2. Run `check` with typescript/no-floating-promises enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification A bare native Promise-returning call must report.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 2, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases A separately authored awaited call in an async function is clean, preserving the same declared Promise result.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoFloatingPromises invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestRuleCorpusNoFloatingPromises(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<number>;
getPromise();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-floating-promises": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-floating-promises]") {
    t.Fatalf("no-floating-promises diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-floating-promises", "declare function getPromise(): Promise<number>;\nasync function main(): Promise<void> { await getPromise(); }\nvoid main;\n")
}
