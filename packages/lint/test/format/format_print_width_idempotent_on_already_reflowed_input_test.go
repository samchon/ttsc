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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the idempotent on already reflowed input fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports zero findings — no edit, no diagnostic.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Use printWidth=20, the same width that breaks the source-form test fixture. The asserted decision is: Assert the rule reports zero findings — no edit, no diagnostic. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIdempotentOnAlreadyReflowedInput is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthIdempotentOnAlreadyReflowedInput(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n",
    `{"printWidth": 20}`,
  )
}
