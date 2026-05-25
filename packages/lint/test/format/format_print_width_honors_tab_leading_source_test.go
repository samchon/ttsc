package linthost

import "testing"

// TestFormatPrintWidthHonorsTabLeadingSource verifies the rule
// correctly expands tab-prefixed lines when computing the printer's
// StartingColumn and BaseIndent.
//
// The existing useTabs test feeds *space*-indented source while
// asking the printer to *output* tabs. The rule-side helpers
// `leadingColumn` and `lineLeadingIndent` are uncovered for the
// inverse case: the source itself begins with tabs, and the rule
// must expand them to visual columns to compute the right indent
// for continuation lines. A regression that treated each leading
// tab as one column would miscount the budget and produce wrong
// child indentation.
//
//  1. Configure printWidth=24, tabWidth=4, useTabs=true.
//  2. Feed `\t\tconst x = { aa: 1, bb: 2, cc: 3 };` — the node
//     sits at visual column 8, plenty wide enough to force the
//     reflow.
//  3. Assert children indent under three tabs (BaseIndent=8 plus
//     one indentUnit=4 → 12 columns → 3 tabs) and the close brace
//     under two tabs (BaseIndent=8 → 2 tabs).
func TestFormatPrintWidthHonorsTabLeadingSource(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "\t\tconst x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 24, "tabWidth": 4, "useTabs": true}`,
    "\t\tconst x = {\n\t\t\taa: 1,\n\t\t\tbb: 2,\n\t\t\tcc: 3,\n\t\t};\n",
  )
}
