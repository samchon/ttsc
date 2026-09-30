package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfAsyncIterableAllows verifies the `for await...of`
// arm of typescript/await-thenable stays silent on every valid shape from the
// upstream regression suite.
//
// These are the negative twins of the sync-iterable positives: an async
// generator (the canonical async iterable), a union with at least one
// async-iterable constituent (upstream accepts when ANY constituent
// implements the protocol), an `any` source (typescript-eslint's explicit
// escape hatch), and a plain `for...of` over a sync array (no `await`
// modifier, so the arm must not even engage). A regression that blanket-bans
// `for await` or unions surfaces here.
//
//  1. Seed a project with four loops that must all stay clean.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
// @evidence contracts/testing.md#behavioral-verification Supported async iteration and unknown-any boundaries must not report.
// @evidence contracts/testing.md#independent-expectations The authored source and original complete assertions fix zero rule findings with code 0 and empty stdout; added per-rule diagnostic parsing rejects wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Async generator, mixed async/sync union and any remain clean alongside an ordinary synchronous loop; SyncIterableReports provides async-loop-over-sync positives.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableForAwaitOfAsyncIterableAllows executes the in-process check command with a real Program/Checker in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableForAwaitOfAsyncIterableAllows(t *testing.T) {
  root := seedLintProject(t, `declare const mixedSource: AsyncIterable<string> | Iterable<string>;
declare const anything: any;
async function main(): Promise<void> {
  async function* streamNumbers(): AsyncGenerator<number> {
    yield 1;
  }
  for await (const streamed of streamNumbers()) {
    JSON.stringify(streamed);
  }
  for await (const mixed of mixedSource) {
    JSON.stringify(mixed);
  }
  for await (const anee of anything) {
    JSON.stringify(anee);
  }
  for (const plain of [1, 2, 3]) {
    JSON.stringify(plain);
  }
}
void main();
`)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("valid async iteration was reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
