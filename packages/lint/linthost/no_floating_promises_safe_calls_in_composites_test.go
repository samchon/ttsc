package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesSafeCallsInComposites verifies a safe-call specifier
// applies to the call itself without suppressing unlisted sibling branches.
//
// The matrix covers every recursive composite family, an explicit void walk,
// a structural thenable under checkThenables, and the existing IIFE escape.
//
// @evidence contracts/testing.md#behavioral-verification Known-safe calls must retain their exemption throughout composite expressions.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 17, 18, 19, 20, 21, 22, 23, 24, 26, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases Sequence, AND/OR/nullish/conditional and void branches pair safe and unsafe calls; thenable and ignored-IIFE cases preserve configured scope.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesSafeCallsInComposites invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestNoFloatingPromisesSafeCallsInComposites(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `interface CatchableThenable {
  then(onFulfilled: () => void, onRejected: () => void): CatchableThenable;
}
declare const condition: boolean;
declare const maybe: boolean | null;
declare function safe(): Promise<void>;
declare function unsafe(): Promise<void>;
declare function safeThenable(): CatchableThenable;
declare function unsafeThenable(): CatchableThenable;
safe();
(safe(), 0);
condition && safe();
condition || safe();
maybe ?? safe();
condition ? safe() : safe();
// unsafe controls
unsafe();
(safe(), unsafe());
condition && unsafe();
condition || unsafe();
maybe ?? unsafe();
condition ? safe() : unsafe();
condition ? unsafe() : safe();
void (safe(), unsafe());
condition && safeThenable();
condition && unsafeThenable();
(async () => { safe(); })();
`, map[string]any{
    "allowForKnownSafeCalls": []any{"safe", "safeThenable"},
    "checkThenables":         true,
    "ignoreIIFE":             true,
    "ignoreVoid":             false,
  })
  if code != 2 || stdout != "" {
    t.Fatalf("safe-call composite run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 9 {
    t.Fatalf("expected 9 unsafe composite findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{
    "main.ts:17:",
    "main.ts:18:",
    "main.ts:19:",
    "main.ts:20:",
    "main.ts:21:",
    "main.ts:22:",
    "main.ts:23:",
    "main.ts:24:",
    "main.ts:26:",
  } {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing unsafe composite finding at %s\n%s", line, stderr)
    }
  }
  for _, line := range []string{
    "main.ts:10:",
    "main.ts:11:",
    "main.ts:12:",
    "main.ts:13:",
    "main.ts:14:",
    "main.ts:15:",
    "main.ts:25:",
    "main.ts:27:",
  } {
    if diagnosticOutputContains(stderr, line) {
      t.Fatalf("configured safe/IIFE expression reported at %s\n%s", line, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 17, 18, 19, 20, 21, 22, 23, 24, 26)
}
