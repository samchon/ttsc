package linthost

import "testing"

// TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileFalse verifies a `while (false)` body's escapes never execute.
//
// The loop test is the literal `false`, so the body — including its
// `break target` — is unreachable; the following `throw` then terminates the
// labeled block and the case. If the constant-false branch leaked the body's
// labeled break, the labeled block would look normally-completing and a
// false positive would appear. Locks the escape-dropping half of the
// constant-false loop branch (KindFalseKeyword folding).
//
// 1. Put a dead `break target` inside `while (false)`, followed by a throw.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsUnreachableLabeledBreakInWhileFalse(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
function f(): void {
  switch (foo) {
    case 0:
      target: {
        while (false) {
          break target;
        }
        throw new Error("stop");
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "")
}
