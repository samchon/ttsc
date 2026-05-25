package linthost

import "testing"

// TestFormatPrintWidthExplodesCallWhenHuggedHeaderOverflows verifies the
// rule reflows a call whose hugged opening line exceeds printWidth into
// the fully exploded argument list.
//
// This is the end-to-end form of the hugged-header overflow fix: before
// it, `ttsc format` would collapse such a call onto one over-wide line
// (leading arguments plus the callback header). The ConditionalGroup
// argument list lets the rule pick the exploded shape so every line
// fits.
//
//  1. Configure printWidth=30.
//  2. Feed a call with two leading arguments and a block callback whose
//     hugged header would overflow.
//  3. Assert each argument reflows onto its own indented line.
func TestFormatPrintWidthExplodesCallWhenHuggedHeaderOverflows(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "register(alphaArg, betaArg, () => { run(); });\n",
    `{"printWidth": 30}`,
    "register(\n  alphaArg,\n  betaArg,\n  () => {\n    run();\n  },\n);\n",
  )
}
