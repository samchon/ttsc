package linthost

import "testing"

// TestFormatPrintWidthExplodesCallWhenHuggedHeaderOverflows exercises the
// rule-level callback layout in one process. A hugged header with both leading
// arguments exceeds width 30, so the complete output must put each argument
// on its own line and preserve the callback's run statement.
//
//  1. Configure printWidth=30.
//  2. Reflow register with two leading arguments and a block callback.
//  3. Compare every argument, callback line and closing delimiter.
//
// @evidence contracts/testing.md#behavioral-verification The registered print-width rule must choose the exploded call rather than an overflowing hugged header, retaining alphaArg, betaArg, the callback and its run() body in order.
// @evidence contracts/testing.md#independent-expectations The supported call-layout policy uses the exploded argument list when its hugged opening line cannot fit the configured budget. Literal equality catches missing arguments, body changes, incorrect commas or a still-flat header.
// @evidence contracts/testing.md#distinguishing-cases This positive owns a callback header that cannot fit with preceding arguments. TestFormatPrintWidthKeepsShortCallWithCallbackHugged supplies the fitting hugged alternative; printer-level callback tests own individual document choices.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthExplodesCallWhenHuggedHeaderOverflows reaches the rule through the same-process engine and snapshot helper. It is a public selected unit entry, not an installed CLI or real-host E2E execution.
func TestFormatPrintWidthExplodesCallWhenHuggedHeaderOverflows(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "register(alphaArg, betaArg, () => { run(); });\n",
    `{"printWidth": 30}`,
    "register(\n  alphaArg,\n  betaArg,\n  () => {\n    run();\n  },\n);\n",
  )
}
