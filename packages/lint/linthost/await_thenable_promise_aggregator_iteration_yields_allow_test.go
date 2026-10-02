package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorIterationYieldsAllow verifies unrelated
// container parameters do not create false positives when the checked iterator
// protocol yields only Promises.
//
//  1. Seed generic, inherited, and structural iterables that yield Promise values.
//  2. Instantiate the generic container with a non-Promise type argument and aggregate every value.
//  3. Assert the real lint command remains clean.
//
// @evidence contracts/testing.md#behavioral-verification Aggregator iterability analysis must inspect yielded types rather than unrelated generic parameters.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix zero rule findings with code 0 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Box<string> yields Promises and stays clean with inherited/structural Promise iterables; IterationYieldsReport has Promise-parameterized Box that actually yields numbers.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorIterationYieldsAllow invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorIterationYieldsAllow(t *testing.T) {
  root := seedLintProject(t, `class Box<T> implements Iterable<Promise<number>> {
  *[Symbol.iterator](): Iterator<Promise<number>> {
    yield Promise.resolve(1);
  }
}
interface InheritedPromises extends Iterable<Promise<number>> {}
interface StructuralPromises {
  [Symbol.iterator](): Iterator<Promise<number>>;
}
declare const unrelatedParameter: Box<string>;
declare const inheritedPromises: InheritedPromises;
declare const structuralPromises: StructuralPromises;
Promise.all(unrelatedParameter);
Promise.allSettled(inheritedPromises);
Promise.race(structuralPromises);
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
    t.Fatalf("Promise-yielding custom iterables were reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
