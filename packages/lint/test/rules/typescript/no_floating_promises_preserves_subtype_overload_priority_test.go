package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesPreservesSubtypeOverloadPriority verifies mutually
// assignable parameter types cannot erase TypeScript's first overload pass.
//
// Numeric enums are mutually assignable with number, but number is not a
// subtype of the enum. TypeScript therefore skips the first overload below in
// its subtype pass and selects the Promise-returning overload. Treating the
// parameter contracts as equivalent would incorrectly discard that Promise.
// @evidence contracts/testing.md#behavioral-verification Mutual assignability must not erase subtype-first overload selection.
// @evidence contracts/testing.md#independent-expectations The authored numeric-enum handler call requires exactly one rule/error diagnostic at line11, code2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases Number-parameter safe return precedes enum-parameter Promise return; the enum handler distinguishes subtype priority from flattened assignability.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesPreservesSubtypeOverloadPriority invokes in-process check command through runNoFloatingPromisesCase and real Program/Checker in the shared Go unit population. All original input/options/assertions stay owned here; no compiler child, installation or native artifact build executes.
func TestNoFloatingPromisesPreservesSubtypeOverloadPriority(t *testing.T) {
  source := `enum Code {
  Value,
}
type Handler = (value: Code) => void;
interface NumericEnumCatch {
  catch(onRejected: (value: number) => void): undefined;
  catch(onRejected: (value: Code) => void): Promise<void>;
}
declare const mixed: Promise<void> | NumericEnumCatch;
declare const handler: Handler;
mixed.catch(handler);
`
  code, stdout, stderr := runNoFloatingPromisesCase(t, source, nil)
  if code != 2 || stdout != "" ||
    strings.Count(stderr, "[typescript/no-floating-promises]") != 1 ||
    !diagnosticOutputContains(stderr, "main.ts:11:") {
    t.Fatalf("numeric-enum overload run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 11)
}
