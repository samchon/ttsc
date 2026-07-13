package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorIterationYieldsReport verifies custom
// iterable diagnostics follow the instantiated iterator yield type instead of
// a container's own generic arguments.
//
//  1. Seed generic, inherited, structural, and primitive-string iterables that yield non-Promise values.
//  2. Pass each iterable to a native Promise aggregator.
//  3. Assert exactly one diagnostic on every offending argument.
func TestAwaitThenablePromiseAggregatorIterationYieldsReport(t *testing.T) {
  root := seedLintProject(t, `class Box<T> implements Iterable<number> {
  *[Symbol.iterator](): Iterator<number> {
    yield 1;
  }
}
interface InheritedNumbers extends Iterable<number> {}
interface StructuralNumbers {
  [Symbol.iterator](): Iterator<number>;
}
declare const promiseParameterized: Box<Promise<void>>;
declare const inheritedNumbers: InheritedNumbers;
declare const structuralNumbers: StructuralNumbers;
declare const text: string;
Promise.all(promiseParameterized);
Promise.allSettled(inheritedNumbers);
Promise.race(structuralNumbers);
Promise.any(text);
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
    t.Fatalf("iteration-yield Promise aggregator run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  const message = "Unexpected iterable of non-Promise (non-\"Thenable\") values passed to promise aggregator."
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 4 {
    t.Fatalf("expected 4 await-thenable findings, got %d:\n%s", got, stderr)
  }
  if got := strings.Count(stderr, message); got != 4 {
    t.Fatalf("expected the exact aggregator diagnostic 4 times, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:14:", "main.ts:15:", "main.ts:16:", "main.ts:17:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing iteration-yield finding at %s:\n%s", anchor, stderr)
    }
  }
}
