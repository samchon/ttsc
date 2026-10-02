package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorNativeIdentity verifies the rule resolves
// the receiver type to the default-library PromiseConstructor instead of
// matching an identifier or method name textually.
//
//  1. Call a computed method through a native Promise alias.
//  2. Call same-named methods on local and declared structural lookalikes.
//  3. Assert only the native alias reports.
//
// @evidence contracts/testing.md#behavioral-verification Aggregator checks must require actual native Promise identity.
// @evidence contracts/testing.md#independent-expectations The authored native alias/computed all call independently requires one rule-labelled error on line 2, while local Promise and structural race calls on lines 9,14 remain clean, with code 2 and empty stdout. Count and literal anchors reject extras; the rendered-main.ts helper checks line 2 and error severity, without certifying exact columns or unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Native global alias with computed all access reports; local Promise shadow and structural race lookalike remain clean.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorNativeIdentity invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorNativeIdentity(t *testing.T) {
  root := seedLintProject(t, `const NativePromise = globalThis.Promise;
NativePromise["all"]([1]);
{
  const Promise = {
    all(values: Iterable<number>): Iterable<number> {
      return values;
    },
  };
  Promise.all([2]);
}
declare const structural: {
  race(values: Iterable<number>): Iterable<number>;
};
structural.race([3]);
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
    t.Fatalf("Promise aggregator identity run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected only the native Promise alias finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:2:") {
    t.Fatalf("native Promise alias was not reported:\n%s", stderr)
  }
  for _, clean := range []string{"main.ts:9:", "main.ts:14:"} {
    if diagnosticOutputContains(stderr, clean) {
      t.Fatalf("structural Promise lookalike reported at %s:\n%s", clean, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 2)
}
