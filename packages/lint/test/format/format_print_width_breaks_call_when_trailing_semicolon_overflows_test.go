package linthost

import "testing"

// TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows verifies
// the rule charges the statement's trailing `;` against the printWidth
// budget, breaking a call whose flat form ends exactly at printWidth
// but whose terminator would spill onto column printWidth+1.
//
// The rule reflows only the call's own byte range; the `;` that follows
// it stays put. Measuring the call in isolation let the engine keep it
// flat at exactly printWidth, after which the `;` overflowed by one
// column — the regression where `ttsc format` produced an over-width
// line. trailingLineWidth feeds that suffix into both the fast path and
// the layout budget so the call breaks instead.
//
//  1. Configure printWidth=26.
//  2. Feed `const x = run((v) => v.ok);` — the call ends at column 26,
//     so the `;` would land on column 27.
//  3. Assert the argument list breaks so every line fits 26 columns.
func TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = run((v) => v.ok);\n",
    `{"printWidth": 26}`,
    "const x = run(\n  (v) => v.ok,\n);\n",
  )
}
