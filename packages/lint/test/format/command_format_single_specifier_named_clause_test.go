package linthost

import "testing"

// TestCommandFormatSingleSpecifierStaysInline covers the full case matrix for
// the print-width single-specifier abstain. Every source is already
// Prettier-3-canonical at printWidth 80, so format must leave it byte-identical
// (idempotent). Cases split into: single-specifier clauses that stay inline
// even past 80 (the fix), and multi-specifier / default-combined clauses that
// stay broken (the negatives the fix must NOT collapse).
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

// TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak proves the
// abstain is scoped to one specifier: a two-specifier clause, and a
// default-plus-single clause, still break when flat and over width. Inputs are
// the flat (mangled) forms; wants are the Prettier-canonical broken forms.
func TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak(t *testing.T) {
  cases := []struct {
    name, src, want string
  }{
    {
      "import_two_flat_breaks",
      `import { TwoSpecsAreBrokenAAAAAAAAAAAAAAAAAA, BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbCccc } from "./m";
`,
      `import {
  TwoSpecsAreBrokenAAAAAAAAAAAAAAAAAA,
  BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbCccc,
} from "./m";
`,
    },
    {
      "export_two_flat_breaks",
      `export { TwoReexportSpecsAreBrokenAAAAAAAAAAAAAAAAAAAAAAA, BbbbbbbbbbbbbbbbCcc } from "./m";
`,
      `export {
  TwoReexportSpecsAreBrokenAAAAAAAAAAAAAAAAAAAAAAA,
  BbbbbbbbbbbbbbbbCcc,
} from "./m";
`,
    },
    // multi specifier whose names fit but whose from-path overflows: the
    // declaration line is over 80, so the brace breaks (Prettier measures the
    // whole line, and ttsc charges the `from "..."` tail as trailing width).
    {
      "export_two_short_from_overflow_breaks",
      `export { ShortA, ShortB } from "./very/long/path/here/exceeding/the/eighty/cols";
`,
      `export {
  ShortA,
  ShortB,
} from "./very/long/path/here/exceeding/the/eighty/cols";
`,
    },
  }
  for _, c := range cases {
    c := c
    t.Run(c.name, func(t *testing.T) { assertFormatResult(t, c.src, c.want) })
  }
}

// TestCommandFormatImportMultiSpecifierFromOverflowBreak documents an asymmetry
// the matrix surfaced: a multi-specifier EXPORT whose names fit but whose
// `from "..."` tail overflows breaks correctly (format/print-width visits
// KindNamedExports directly and charges the trailing width), but the IMPORT
// counterpart does not. An import is reflowed through KindImportDeclaration ->
// printImportDeclaration, whose named group is rendered without charging the
// ` from "..."` tail against the line budget, so the brace stays flat. Fixing
// it means teaching the import doc-render path the trailing width the export
// path already measures. Skipped until that slice; the assertion is the target.
func TestCommandFormatImportMultiSpecifierFromOverflowBreak(t *testing.T) {
  assertFormatResult(t,
    `import { ShortC, ShortD } from "./very/long/path/here/exceeding/the/eighty/colss";
`,
    `import {
  ShortC,
  ShortD,
} from "./very/long/path/here/exceeding/the/eighty/colss";
`)
}

// TestCommandFormatDefaultImportSingleSpecifierBreak documents a counter-example
// the single-specifier abstain surfaced but does NOT own: a default-combined
// import (`import D, { X } from "long"`) over printWidth must break in Prettier,
// but print-width keeps any default-combined import verbatim in v1
// (print_nodes_imports.go printImportDeclaration, the `clause.Name() != nil`
// guard), so it stays flat. The abstain is correctly scoped not to claim this
// case (isSingleSpecifierNamedClause returns false when a default binding is
// present), leaving it to a future default-import reflow slice. Skipped until
// that slice lands; the assertion below is the target behavior.
func TestCommandFormatDefaultImportSingleSpecifierBreak(t *testing.T) {
  assertFormatResult(t,
    `import Default, { OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo } from "./m";
`,
    `import Default, {
  OneNamedAlongsideDefaultExceedingTheEightyColumnPrintWidthAo,
} from "./m";
`)
}
