package linthost

import "testing"

// TestCommandFormatSingleSpecifierStaysInline covers the full case matrix for
// the print-width single-specifier abstain. Every source is already
// Prettier-3-canonical at printWidth 80, so format must leave it byte-identical
// (idempotent). Cases split into: single-specifier clauses that stay inline
// even past 80 (the fix), and multi-specifier / default-combined clauses that
// stay broken (the negatives the fix must NOT collapse).
//
// @evidence contracts/testing.md#behavioral-verification The format command must preserve canonical single-specifier import/export clauses even when names or module tails exceed width, and retain canonical broken multi/default clauses.
// @evidence contracts/testing.md#independent-expectations The twelve literal source fixtures encode measured canonical shapes independently; exact equality retains binding kinds, aliases and module paths.
// @evidence contracts/testing.md#distinguishing-cases Named cases distinguish ordinary/type-only/aliased/sourceless singles, long module tails, two specifiers and default-plus-named forms. The multi-break sibling supplies changed inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatSingleSpecifierStaysInline is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
func TestCommandFormatSingleSpecifierStaysInline(t *testing.T) {
  cases := []struct {
    name string
    src  string
  }{
    // --- single specifier: must stay inline even when the line exceeds 80 ---
    {"import_single_over_width", `import { OneSpecifierWithAVeryLongNameExceedingTheEightyColumnPrintWidth } from "./m";
`},
    {"import_type_single", `import type { OneTypeOnlySpecifierWithAVeryLongNameExceedingPrintWidthLimitHere } from "./m";
`},
    {"import_alias_single", `import { OriginalLongLongName as AliasedLongLongNameExceedingEightyColumnsHereX } from "./m";
`},
    {"export_single_from", `export { OneSpecifierWithAVeryLongNameExceedingTheEightyColumnPrintWidthLimit } from "./m";
`},
    {"export_type_single_from", `export type { OneTypeOnlyReexportSpecifierWithAVeryLongNameExceedingPrintWidth } from "./m";
`},
    {"export_single_no_from", `export { OneLocalSpecifierNoFromClauseWithAVeryLongNameExceedingEightyColumns };
`},
    // --- single specifier, short name but the from-path overflows: still inline ---
    {"import_single_short_from_overflow", `import { ShortY } from "./very/long/path/here/exceeding/the/eighty/columns/okok2";
`},
    {"export_single_short_from_overflow", `export { ShortX } from "./very/long/path/here/exceeding/the/eighty/columns/okok";
`},
    {"export_type_single_short_from_overflow", `export type { ShortZ } from "./very/long/path/here/exceeding/eighty/cols/typeok";
`},
    // --- negatives: must STAY broken (the abstain must not collapse these) ---
    {"import_two_broken", `import {
  TwoSpecsAreBrokenAAAAAAAAAAAAAAAAAA,
  BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbCccc,
} from "./m";
`},
    {"import_default_plus_single_broken", `import Default, {
  OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo,
} from "./m";
`},
    {"export_two_broken", `export {
  TwoReexportSpecsAreBrokenAAAAAAAAAAAAAAAAAAAAAAA,
  BbbbbbbbbbbbbbbbCcc,
} from "./m";
`},
  }
  for _, c := range cases {
    c := c
    t.Run(c.name, func(t *testing.T) { assertFormatUnchanged(t, c.src) })
  }
}
