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
}
