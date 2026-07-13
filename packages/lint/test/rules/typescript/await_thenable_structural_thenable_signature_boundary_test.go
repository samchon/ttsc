package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableStructuralThenableSignatureBoundary verifies a callable
// then property is awaitable only when its first parameter is a fulfillment
// callback, matching the TypeScript checker's Promise-like contract.
//
//  1. Await valid and zero-parameter structural then methods.
//  2. Run check with typescript/await-thenable enabled as error.
//  3. Assert only the invalid then signature reports.
func TestAwaitThenableStructuralThenableSignatureBoundary(t *testing.T) {
  root := seedLintProject(t, `declare const valid: {
  then(onfulfilled: (value: number) => unknown): unknown;
};
declare const invalid: {
  then(): void;
};
async function main(): Promise<void> {
  await valid;
  // @ts-expect-error: intentionally invalid structural thenable signature
  await invalid;
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
    t.Fatalf("structural thenable signature run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:10:") {
    t.Fatalf("invalid structural thenable was not reported:\n%s", stderr)
  }
}
