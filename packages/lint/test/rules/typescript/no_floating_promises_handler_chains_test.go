package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesHandlerChains verifies rejection handlers must be
// callable and finally inherits rather than replaces the receiver's state.
//
// This separates callable dot/computed handlers and non-null assertions from
// absent handlers, an unhandled finally receiver, and shifted spread arguments.
//
//  1. Build handled and unhandled dot/computed Promise chains.
//  2. Run the rule with scalar defaults.
//  3. Assert only the invalid handler, finally, and spread lines report.
func TestNoFloatingPromisesHandlerChains(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `declare const promise: Promise<void>;
declare const maybeHandler: ((reason: unknown) => void) | undefined;
const noArguments: [] = [];
promise.catch(() => undefined);
promise.then(undefined, () => undefined);
promise.catch(() => undefined).finally(() => undefined);
promise["catch"](() => undefined);
promise["then"](undefined, () => undefined);
promise["catch"](() => undefined)["finally"](() => undefined);
promise.catch(maybeHandler!);
promise.catch(undefined);
promise.then(undefined, undefined);
promise.finally(() => undefined);
promise.then(...noArguments, () => undefined);
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("handler run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 4 {
    t.Fatalf("expected 4 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:11:", "main.ts:12:", "main.ts:13:", "main.ts:14:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing handler finding at %s\n%s", line, stderr)
    }
  }
}
