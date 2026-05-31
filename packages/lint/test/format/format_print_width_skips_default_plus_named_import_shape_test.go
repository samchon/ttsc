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
func TestFormatPrintWidthBreaksDefaultPlusNamedImportShape(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "import D, { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 10}`,
    "import D, {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
  )
}
