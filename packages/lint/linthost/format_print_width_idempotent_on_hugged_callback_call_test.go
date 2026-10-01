package linthost

import "testing"

// TestFormatPrintWidthIdempotentOnHuggedCallbackCall verifies a second
// formatPrintWidth pass over an already-hugged callback call emits
// zero findings.
//
// `ttsc format` runs a convergence cascade; a rule whose render output
// drifted from its own previous output — even by a stray space or a
// shifted indent — would burn passes and eventually trip the "did not
// converge" guard. The hugged-callback shape this rule now produces
// must be a fixed point: feeding the canonical hugged form back in must
// reflow to itself byte-for-byte.
//
//  1. Feed an already-hugged `new Singleton(() => { … })` whose body is
//     correctly indented two spaces.
//  2. Run formatPrintWidth at the default width.
//  3. Assert the rule reports zero findings.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the idempotent on hugged callback call fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports zero findings.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed an already-hugged `new Singleton(() => { … })` whose body is correctly indented two spaces. The asserted decision is: Assert the rule reports zero findings. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIdempotentOnHuggedCallbackCall is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthIdempotentOnHuggedCallbackCall(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(() => {\n  doStuff();\n  return 1;\n});\n",
  )
}
