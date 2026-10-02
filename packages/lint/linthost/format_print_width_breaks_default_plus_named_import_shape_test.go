package linthost

import "testing"

// TestFormatPrintWidthBreaksDefaultPlusNamedImportShape verifies a
// default-combined import now reflows. The whole declaration renders as one
// group (Prefix `import D, ` + Suffix ` from "x"`), so an overflowing
// `import D, { … } from "x"` breaks its named brace — the default binding
// stays on the `import D, {` line, matching Prettier. Previously the printer
// kept the shape verbatim (a v1 limitation).
//
//  1. Configure printWidth=10 (forces the reflow).
//  2. Feed `import D, { alpha, bravo, charlie } from "x";`.
//  3. Assert the broken Prettier shape.
//
// @evidence contracts/testing.md#behavioral-verification The overflowing combined import must retain D on the import opening line and break alpha/bravo/charlie into the named clause, preserving the module and semicolon. Losing the default binding or splitting declaration ownership fails the full snapshot.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 independently yields the literal combined-import output at width 10. Print width is a layout preference rather than a hard guarantee for indivisible module/identifier text; the oracle preserves those tokens even when a line still exceeds ten.
// @evidence contracts/testing.md#distinguishing-cases This host owns the combined default-and-named positive at a narrow budget. The named-only import host distinguishes an absent default prefix; the namespace negative owns the indivisible clause that must not be split.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksDefaultPlusNamedImportShape owns the options-bearing literal fixture and complete applied output through the in-process Go rule engine. No consumer import, native artifact production or product process is required.
func TestFormatPrintWidthBreaksDefaultPlusNamedImportShape(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "import D, { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 10}`,
    "import D, {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
  )
}
