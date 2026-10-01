package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesOptions verifies the three scalar option switches and
// the known-safe call/type allowlists change only their owned branches.
//
// The case pairs a structural thenable, void expression, async IIFE, safe call,
// safe Promise subclass, and an ordinary Promise control.
//
//  1. Enable thenable checks while disabling void and enabling IIFE escapes.
//  2. Allow one call and one Promise type by name.
//  3. Assert only the thenable, void operand, and ordinary Promise report.
// @evidence contracts/testing.md#behavioral-verification Known-safe exemptions and thenable/void/IIFE gates must act at their configured boundaries.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 9, 10, 14, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases The authored custom thenable, explicit void and native Promise report; listed safe call/Promise and ignored IIFE stay clean. Exemptions are user policy rather than a runtime completion proof.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesOptions invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestNoFloatingPromisesOptions(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `interface CustomThenable {
  then(onFulfilled: () => void, onRejected: () => void): CustomThenable;
}
declare const thenable: CustomThenable;
declare const promise: Promise<void>;
declare function safeCall(): Promise<void>;
class SafePromise<T> extends Promise<T> {}
declare const safePromise: SafePromise<void>;
thenable;
void promise;
(async () => undefined)();
safeCall();
safePromise;
promise;
`, map[string]any{
    "allowForKnownSafeCalls":    []any{"safeCall"},
    "allowForKnownSafePromises": []any{"SafePromise"},
    "checkThenables":            true,
    "ignoreIIFE":                true,
    "ignoreVoid":                false,
  })
  if code != 2 || stdout != "" {
    t.Fatalf("option run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 3 {
    t.Fatalf("expected 3 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:9:", "main.ts:10:", "main.ts:14:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing option finding at %s\n%s", line, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 9, 10, 14)
}
