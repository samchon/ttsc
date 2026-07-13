package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesHandlerChains verifies rejection handlers must be
// callable and finally inherits rather than replaces the receiver's state.
//
// This separates valid catch/then chains from syntactically present but
// non-callable handlers and from an unhandled finally receiver.
//
//  1. Build three handled and three unhandled Promise chains.
//  2. Run the rule with scalar defaults.
//  3. Assert only the invalid handler and finally lines report.
func TestNoFloatingPromisesHandlerChains(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `declare const promise: Promise<void>;
promise.catch(() => undefined);
promise.then(undefined, () => undefined);
promise.catch(() => undefined).finally(() => undefined);
promise.catch(undefined);
promise.then(undefined, undefined);
promise.finally(() => undefined);
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("handler run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 3 {
    t.Fatalf("expected 3 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:5:", "main.ts:6:", "main.ts:7:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing handler finding at %s\n%s", line, stderr)
    }
  }
}
