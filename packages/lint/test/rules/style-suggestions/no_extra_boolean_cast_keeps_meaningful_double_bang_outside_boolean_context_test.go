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
func TestNoExtraBooleanCastKeepsMeaningfulDoubleBangOutsideBooleanContext(t *testing.T) {
	assertRuleSkipsSource(
		t,
		"no-extra-boolean-cast",
		"function f(x: any) {\n  const b = !!x;\n  return b;\n}\nJSON.stringify(f);\n",
	)
}
