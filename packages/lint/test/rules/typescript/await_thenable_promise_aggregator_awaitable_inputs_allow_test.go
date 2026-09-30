package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorAwaitableInputsAllow verifies Promise
// containers and values whose awaitability is unknown remain valid negative
// twins of the non-awaitable aggregator cases.
//
//  1. Seed Promise arrays, tuples, Iterables, and literal May values.
//  2. Pass each value to a native Promise aggregator.
//  3. Assert a clean run with no await-thenable finding.
// @evidence contracts/testing.md#behavioral-verification Promise aggregators must allow supported Promise-bearing and uncertain input elements.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix zero rule findings with code 0 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Promise arrays, tuples, iterable values, maybe-Promise/unknown/any members, holes and unconstrained generic elements remain clean; ContainerShapesReport and LiteralMembersReport provide definite-scalar counterparts.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorAwaitableInputsAllow invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorAwaitableInputsAllow(t *testing.T) {
  root := seedLintProject(t, `declare const promises: Promise<number>[];
declare const tuple: readonly [Promise<number>, Promise<string>];
declare const iterable: Iterable<Promise<number>>;
declare const maybePromise: number | Promise<number>;
declare const unknownValue: unknown;
declare const anyValue: any;
Promise.all(promises);
Promise.allSettled(tuple);
Promise.any(iterable);
Promise.race([maybePromise, unknownValue, anyValue, Promise.resolve(1)]);
Promise.all([, Promise.resolve(1)]);
function aggregate<T>(values: Iterable<T>): void {
  void Promise.all(values);
}
void aggregate;
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
    t.Fatalf("awaitable Promise aggregator inputs were reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
