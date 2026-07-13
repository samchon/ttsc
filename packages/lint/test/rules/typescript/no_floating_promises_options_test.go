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
}

// TestNoFloatingPromisesRecursiveEscapes verifies safe-call and IIFE escapes
// remain effective when a conditional or finally chain hides the configured
// expression below the statement root.
func TestNoFloatingPromisesRecursiveEscapes(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `declare const flag: boolean;
declare function safeCall(): Promise<void>;
flag ? safeCall() : undefined;
flag && safeCall();
safeCall().finally(() => undefined);
flag ? (async () => undefined)() : undefined;
(async () => undefined)().finally(() => undefined);
Promise.resolve();
`, map[string]any{
    "allowForKnownSafeCalls": []any{"safeCall"},
    "ignoreIIFE":             true,
  })
  if code != 2 || stdout != "" {
    t.Fatalf("recursive escape run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 1 {
    t.Fatalf("expected only the ordinary Promise control, got %d findings:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:8:") {
    t.Fatalf("missing ordinary Promise control finding:\n%s", stderr)
  }
}
