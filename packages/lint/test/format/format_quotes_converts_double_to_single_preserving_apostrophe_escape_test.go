package linthost

import "testing"

// TestFormatQuotesConvertsDoubleToSinglePreservingApostropheEscape verifies
// the convert path (not just the abstain path) handles a redundant `\'`
// correctly. Under prefer:"single" a double-quoted literal with two `\"`
// and a redundant `\'` flips to single: the `\"` become bare `"` and the
// `\'` survives as a now-required escape. Matches Prettier 3.8.3
// (`prettier --single-quote`), which keeps the redundant escape rather than
// stripping it.
//
//  1. Parse `"a\"b\"c\'"` (two escaped doubles, one redundant escaped single).
//  2. Apply format/quotes with prefer:"single".
//  3. Assert it becomes `'a"b"c\”`.
func TestFormatQuotesConvertsDoubleToSinglePreservingApostropheEscape(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quotes",
    "const s = "+`"a\"b\"c\'"`+";\n",
    `{"prefer":"single"}`,
    "const s = "+`'a"b"c\''`+";\n",
  )
}
