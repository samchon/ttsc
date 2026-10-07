package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesPreservesOptionalCallbackOverloads verifies a reduced
// callback-arity proof cannot discard a possibly applicable unsafe overload.
//
// TypeScript relates callback arity using effective target parameter counts
// plus declaration-sensitive optional and variance rules, not by comparing
// minimum counts alone. A later safe overload must not become unique because
// that relation was flattened.
//
//  1. Put a Promise-returning optional-callback overload before a concrete safe twin.
//  2. Pass a required-second-parameter callback to a method-derived optional contract.
//  3. Assert the uncertain unsafe candidate keeps the mixed call reportable.
//
// @evidence contracts/testing.md#behavioral-verification Callback-arity simplification must not discard a potentially applicable unsafe optional-method overload.
// @evidence contracts/testing.md#independent-expectations The authored mixed.catch expression requires exactly one rule/error diagnostic at line9, code2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases Method-derived optional callback contract contrasts with a concrete required-second-parameter safe overload; uncertainty must prevent selecting the safe branch.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesPreservesOptionalCallbackOverloads invokes in-process check command through runNoFloatingPromisesCase and real Program/Checker in the shared Go unit population. All original input/options/assertions stay owned here; no compiler child, installation or native artifact build executes.
func TestNoFloatingPromisesPreservesOptionalCallbackOverloads(t *testing.T) {
  source := `type OptionalCallback<T> = {
  method(reason: unknown, extra?: number): T;
}["method"];
interface OptionalCallbackCatch {
  catch<T>(onRejected: OptionalCallback<T>): Promise<void>;
  catch(onRejected: (reason: unknown, extra: number) => void): undefined;
}
declare const mixed: Promise<void> | OptionalCallbackCatch;
mixed.catch((reason: unknown, extra: number) => undefined);
`
  code, stdout, stderr := runNoFloatingPromisesCase(t, source, nil)
  if code != 2 || stdout != "" ||
    strings.Count(stderr, "[typescript/no-floating-promises]") != 1 ||
    !diagnosticOutputContains(stderr, "main.ts:9:") {
    t.Fatalf("optional callback overload run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 9)
}
