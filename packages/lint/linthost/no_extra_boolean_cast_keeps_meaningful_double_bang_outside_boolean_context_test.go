package linthost

import "testing"

// TestNoExtraBooleanCastKeepsMeaningfulDoubleBangOutsideBooleanContext
// verifies a free-standing `const b = !!x;` is NOT flagged.
//
// The double-bang outside a boolean context is the canonical idiom for
// coercing an arbitrary value to a real `boolean`. Treating that as
// redundant would silently change the runtime value's type. This test
// pins the `isInBooleanContext` negative branch so the meaningful-
// coercion path stays untouched by both diagnostics and autofix.
//
// 1. Snapshot `const b = !!x;` source.
// 2. Enable `no-extra-boolean-cast`.
// 3. Assert no findings emitted.
//
// @evidence contracts/testing.md#behavioral-verification Leaves !!x assigned to a returned variable unchanged.
// @evidence contracts/testing.md#independent-expectations Here explicit conversion determines the returned value type, and is not redundant contextual coercion; authored zero findings follows that distinction.
// @evidence contracts/testing.md#distinguishing-cases Value-producing double bang contrasts with the if-condition positive.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoExtraBooleanCastKeepsMeaningfulDoubleBangOutsideBooleanContext(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  const b = !!x;\n  return b;\n}\nJSON.stringify(f);\n",
  )
}
