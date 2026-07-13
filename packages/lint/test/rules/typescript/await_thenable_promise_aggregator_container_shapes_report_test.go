package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorContainerShapesReport verifies typed
// arrays, tuples, Iterables, element unions, and container unions expose their
// non-awaitable member types to the Promise aggregator check.
//
//  1. Seed one invalid value for each supported container boundary.
//  2. Pass the values to native Promise aggregators.
//  3. Assert one finding on each complete argument expression.
func TestAwaitThenablePromiseAggregatorContainerShapesReport(t *testing.T) {
  root := seedLintProject(t, `declare const numbers: number[];
declare const tuple: readonly [Promise<number>, string];
declare const iterable: Iterable<number>;
declare const mixedElements: Array<number | Promise<number>>;
declare const mixedContainers: number[] | Promise<number>[];
Promise.all(numbers);
Promise.all(tuple);
Promise.allSettled(iterable);
Promise.race(mixedElements);
Promise.any(mixedContainers);
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
    t.Fatalf("Promise aggregator container run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 5 {
    t.Fatalf("expected 5 await-thenable findings, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:6:", "main.ts:7:", "main.ts:8:", "main.ts:9:", "main.ts:10:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing typed-container finding at %s:\n%s", anchor, stderr)
    }
  }
}
