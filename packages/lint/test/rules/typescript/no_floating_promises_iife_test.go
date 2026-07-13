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
}
