package linthost

import "testing"

// TestCommandFormatSingleSpecifierStaysInline covers twelve authored fixed
// points for print-width single-specifier abstention at width 80. Nine
// single-specifier clauses stay inline despite their width; three broken
// multi-specifier or default-combined declarations remain broken. This
// concrete population does not certify every clause grammar or external parity.
//
// @evidence contracts/testing.md#behavioral-verification Twelve subcases run the in-process `format` command on authored import and export declarations over 80 columns and require each unchanged: nine single-specifier clauses (plain, type-only, aliased, with or without `from`, long name or long module tail) stay inline, and three already-broken multi-specifier and default-plus-named clauses stay broken.
// @evidence contracts/testing.md#independent-expectations Complete sources are independent authored expected literals preserving import/export kind, type-only markers, original and aliased names, default bindings, specifier order and module paths; nothing is derived from formatter output or an external invocation.
// @evidence contracts/testing.md#distinguishing-cases Single-specifier inputs that a width-based formatter would break are contrasted with multi-specifier or default-combined clauses that must not be collapsed. All are fixed points; the changed-input twins live in TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
