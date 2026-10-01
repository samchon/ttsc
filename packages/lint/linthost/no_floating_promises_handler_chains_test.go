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
// @evidence contracts/testing.md#behavioral-verification Handler recognition must require a supported callable rejection arm and preserve receiver certainty.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 11, 12, 13, 14, 17, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases Direct/computed catch and then rejection callbacks, nested finally and asserted handler stay clean; undefined, finally-only, spread-argument and mixed unrelated receiver cases report.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesHandlerChains invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
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
interface UnrelatedHandler { catch(handler: (reason: unknown) => void): Promise<void>; }
declare const mixedReceiver: Promise<void> | UnrelatedHandler;
mixedReceiver.catch(() => undefined);
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("handler run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 5 {
    t.Fatalf("expected 5 findings, got %d:\n%s", got, stderr)
  }
  for _, line := range []string{"main.ts:11:", "main.ts:12:", "main.ts:13:", "main.ts:14:", "main.ts:17:"} {
    if !diagnosticOutputContains(stderr, line) {
      t.Fatalf("missing handler finding at %s\n%s", line, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 11, 12, 13, 14, 17)
}
