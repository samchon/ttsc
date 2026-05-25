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
func TestFormatPrintWidthIdempotentOnHuggedCallbackCall(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(() => {\n  doStuff();\n  return 1;\n});\n",
  )
}
