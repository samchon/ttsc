package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesDefaultSemantics verifies the scalar defaults reject
// every unhandled built-in Promise form without opting structural thenables in.
//
// The regression combines missing rejection handlers, a still-floating
// finally chain, and a Promise-bearing array with a custom thenable control.
//
//  1. Discard four built-in Promise forms and one custom catchable thenable.
//  2. Run the rule with no options.
//  3. Assert exactly the four built-in forms report.
func TestNoFloatingPromisesDefaultSemantics(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `Promise.reject(new Error("catch")).catch();
Promise.reject(new Error("finally")).finally(() => undefined);
Promise.resolve().then(undefined, undefined);
[Promise.resolve(1), Promise.resolve(2)];
interface CustomThenable {
  then(onFulfilled: () => void, onRejected: () => void): CustomThenable;
}
declare const customThenable: CustomThenable;
customThenable;
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("default run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 4 {
    t.Fatalf("expected 4 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:1:", "main.ts:2:", "main.ts:3:", "main.ts:4:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing default finding at %s\n%s", line, stderr)
    }
  }
  if diagnosticOutputContains(stderr, "main.ts:9:") {
    t.Fatalf("custom thenable reported under checkThenables=false:\n%s", stderr)
  }
}
