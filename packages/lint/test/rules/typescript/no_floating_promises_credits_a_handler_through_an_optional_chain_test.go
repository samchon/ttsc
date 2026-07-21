package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesCreditsAHandlerThroughAnOptionalChain verifies a
// rejection handler still counts when the receiver arrives through an optional
// chain.
//
// The receiver walk skipped the null and undefined branches of a union only
// when the access itself carried `?.`. An optional chain short-circuits as a
// whole, so in `maybe?.run().catch(handler)` the `.catch` carries no token of
// its own, the `undefined` branch of `Promise<void> | undefined` looked like a
// real receiver, and the rule reported a chain that ends in a callable handler
// — contradicting its own message. Reported externally as #794.
//
//  1. Handle and discard a promise reached through an optional chain, and do
//     the same directly on a native Promise.
//  2. Run the rule with no options.
//  3. Assert only the two genuinely unhandled statements report, so the chain's
//     handler is credited without disarming the rule.
func TestNoFloatingPromisesCreditsAHandlerThroughAnOptionalChain(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `declare const maybe: { run(): Promise<void> } | undefined;
declare const promise: Promise<void>;
maybe?.run().catch(() => undefined);
maybe?.run();
promise.catch(() => undefined);
promise;
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 2 {
    t.Fatalf("expected 2 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:4:", "main.ts:6:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing unhandled finding at %s\n%s", line, stderr)
    }
  }
  if diagnosticOutputContains(stderr, "main.ts:3:") {
    t.Fatalf("handler through an optional chain was not credited:\n%s", stderr)
  }
  if diagnosticOutputContains(stderr, "main.ts:5:") {
    t.Fatalf("direct handler stopped being credited:\n%s", stderr)
  }
}
