package linthost

import "testing"

// TestFormatIndentStillFixesSingleLineHeadArrowBody guards against the
// multi-line-head cede over-reaching: an arrow whose head is on ONE line
// (`const f = () => {`) opens its block at column 0, so depth*tabWidth is
// correct and format/indent must still fix a mis-indented body. Pairs with
// TestFormatIndentCedesBodyUnderMultilineArrowHead.
//
//  1. Parse a single-line-head arrow whose body statement has no indent.
//  2. Apply format/indent.
//  3. Assert the body is indented to one level.
func TestFormatIndentStillFixesSingleLineHeadArrowBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "const f = () => {\nconst x = 1\n}\n",
    `{"tabWidth":2}`,
    "const f = () => {\n  const x = 1\n}\n",
  )
}
