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
//  3. Assert one finding on the source line of each aggregator call.
//
// @evidence contracts/testing.md#behavioral-verification Typed aggregator containers must report definite scalar element boundaries.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix the complete rule/error line list 6,7,8,9,10 with code 2 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Number arrays, mixed Promise/string tuples, scalar iterables and mixed typed element/container unions report; AwaitableInputsAllow supplies clean Promise-bearing inputs. These explicit fixtures pin the supported typed-container policy.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorContainerShapesReport invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
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
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 6, 7, 8, 9, 10)
}
