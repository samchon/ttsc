package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfSyncIterableReports verifies the `for await...of`
// arm of typescript/await-thenable fires on every merely-sync iterable shape
// under a real Program.
//
// The rule historically visited only KindAwaitExpression, so `for await` over
// a sync iterable never reported (#413). This locks the three upstream
// positive shapes at once: a sync array, a sync generator, and — the case a
// naive "does it yield Promises?" heuristic would wrongly accept — a sync
// array OF Promises, which typescript-eslint still rejects because the
// container itself has no `[Symbol.asyncIterator]`. The expected columns pin
// the diagnostic to the iterable expression, not the whole statement.
//
//  1. Seed a project with three `for await` loops over sync iterables.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly three findings, each anchored at its iterable
//     expression, with the upstream message text.
func TestAwaitThenableForAwaitOfSyncIterableReports(t *testing.T) {
  root := seedLintProject(t, `async function main(): Promise<void> {
  for await (const value of [1, 2, 3]) {
    JSON.stringify(value);
  }
  function* nums(): Generator<number> {
    yield 1;
  }
  for await (const num of nums()) {
    JSON.stringify(num);
  }
  const promises = [Promise.resolve(1), Promise.resolve(2)];
  for await (const resolved of promises) {
    JSON.stringify(resolved);
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
  if code != 2 || stdout != "" {
    t.Fatalf("for-await-of sync iterable run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 3 {
    t.Fatalf("expected 3 await-thenable findings, got %d:\n%s", got, stderr)
  }
  if !strings.Contains(stderr, "Unexpected `for await...of` of a value that is not async iterable.") {
    t.Fatalf("missing upstream for-await-of message:\n%s", stderr)
  }
  for _, anchor := range []string{"main.ts:2:29", "main.ts:8:27", "main.ts:12:32"} {
    if !strings.Contains(stderr, anchor) {
      t.Fatalf("finding not anchored at iterable expression %s:\n%s", anchor, stderr)
    }
  }
}
