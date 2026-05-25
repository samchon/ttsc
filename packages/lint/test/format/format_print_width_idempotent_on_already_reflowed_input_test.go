package linthost

import "testing"

// TestFormatPrintWidthIdempotentOnAlreadyReflowedInput verifies a
// second `ttsc format` pass over an already-reflowed file emits zero
// findings.
//
// `ttsc format` runs a cascade up to ten passes and refuses to converge
// when fixes keep getting applied. A rule whose render output drifted
// from the original even slightly would burn passes and eventually
// trip the "did not converge" stderr message. The case asserts the
// post-reflow shape is a fixed point of the rule by feeding the
// broken form directly and configuring the same width that produced
// it.
//
//  1. Use printWidth=20, the same width that breaks the source-form
//     test fixture.
//  2. Feed an already-broken object literal as the input.
//  3. Assert the rule reports zero findings — no edit, no diagnostic.
func TestFormatPrintWidthIdempotentOnAlreadyReflowedInput(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n",
    `{"printWidth": 20}`,
  )
}
