package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoMisusedPromises verifies the lint rule corpus fixture
// no-misused-promises.ts under a real Program.
//
// `typescript/no-misused-promises` is type-aware: the engine's
// checker-less AST harness used by `assertRuleCorpusCase` skips it
// because Context.Checker is nil. The rule reuses the `command_*`
// shape established by `no-floating-promises`'s corpus test:
// materialize a tsconfig project, run `ttsc lint check`, and assert on
// the rendered diagnostics.
//
// 1. Seed a project that places a Promise in an `if` condition.
// 2. Run `check` with typescript/no-misused-promises enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
func TestRuleCorpusNoMisusedPromises(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<boolean>;
async function main(): Promise<void> {
  if (getPromise()) {
    JSON.stringify("hit");
  }
}
void main();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-misused-promises": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-misused-promises]") {
    t.Fatalf("no-misused-promises diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
