package linthost

import (
  "strings"
  "testing"
)

// TestNoFloatingPromisesChecksIIFEByDefault locks the default half of the
// ignoreIIFE option while TestNoFloatingPromisesOptions covers the opt-out.
//
//  1. Discard an async IIFE under scalar defaults.
//  2. Run the real checker-backed rule command.
//  3. Assert the IIFE is the single reported Promise.
// @evidence contracts/testing.md#behavioral-verification Async IIFEs must report by default.
// @evidence contracts/testing.md#independent-expectations Independently authored source and original assertions require exact error lines 1, code 2 and empty stdout for reporting command runs; all original inputs/options and clean arms are retained.
// @evidence contracts/testing.md#distinguishing-cases Options exercises ignoreIIFE=true on the same async-IIFE shape while retaining other active checks.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesChecksIIFEByDefault invokes the in-process check command over a real Program/Checker through the owning floating-promise fixture helpers in one Go unit process, without a native build, installed consumer or compiler child.
func TestNoFloatingPromisesChecksIIFEByDefault(t *testing.T) {
  code, stdout, stderr := runNoFloatingPromisesCase(t, `(async () => undefined)();
`, nil)
  if code != 2 || stdout != "" {
    t.Fatalf("default IIFE run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 1 {
    t.Fatalf("expected one default IIFE finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:1:") {
    t.Fatalf("missing default IIFE finding:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-floating-promises", stderr, 1)
}
