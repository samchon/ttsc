package linthost

import "testing"

// TestFixNoExtraBooleanCastDropsDoubleBangInBooleanContext verifies the
// `if (!!x)` → `if (x)` rewrite — the double-bang branch inside a
// boolean-context detection.
//
// Without this fix the `fix` cascade cannot converge on fixtures that
// use `if (!!x)` in hot paths. The detection branch already filters by
// `isInBooleanContext`, so this test pins exactly the
// boolean-context-double-bang path.
//
// 1. Snapshot `if (!!x)` source.
// 2. Apply `no-extra-boolean-cast` fix.
// 3. Assert the result drops the `!!` coercion.
func TestFixNoExtraBooleanCastDropsDoubleBangInBooleanContext(t *testing.T) {
	assertFixSnapshot(
		t,
		"no-extra-boolean-cast",
		"function f(x: any) {\n  if (!!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
		"function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
	)
}
