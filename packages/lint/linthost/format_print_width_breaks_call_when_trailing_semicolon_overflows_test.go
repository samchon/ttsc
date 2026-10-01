package linthost

import "testing"

// TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows charges the
// statement suffix against the call budget. The flat call ends at column 26
// and its semicolon lands at 27; ignoring the untouched suffix would miss
// the required break at width 26.
//
//  1. Reflow the statement at width 26 and compare the complete argument layout.
//  2. Preserve the same statement when width 27 admits its terminator.
//
// @evidence contracts/testing.md#behavioral-verification The owning rule must break run's arrow argument at width 26 while preserving v.ok, the declaration and semicolon. The same input at width 27 must remain silent.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 independently produces the literal broken output at width 26. The input's call/declaration prefix is 26 columns and semicolon makes 27, so adjacent budgets test suffix charging independently of the helper implementation.
// @evidence contracts/testing.md#distinguishing-cases Widths 26/27 with identical source distinguish suffix overflow from a fitting call. The trailing-line-comment host supplies an excluded comment suffix, while this host requires the real terminator to count.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows owns both literal cases via same-process rule-engine helpers. This selected public Go unit starts no product process and builds or installs no artifact.
func TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = run((v) => v.ok);\n",
    `{"printWidth": 26}`,
    "const x = run(\n  (v) => v.ok,\n);\n",
  )
  assertRuleSkipsSourceWithOptions(t, "format/print-width", "const x = run((v) => v.ok);\n", `{"printWidth": 27}`)
}
