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
//
// @evidence contracts/testing.md#behavioral-verification Structural thenability must require a fulfillment-callback signature.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix the complete rule/error line list 10 with code 2 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases The original valid then(callback) await stays clean while then():void reports; original compiler suppression for the malformed signature remains retained.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableStructuralThenableSignatureBoundary invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
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
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 10)
}
