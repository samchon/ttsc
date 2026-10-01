package linthost

import "testing"

// TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak proves the
// abstain is scoped to one specifier: a two-specifier clause, and a
// default-plus-single clause, still break when flat and over width. Inputs are
// the flat (mangled) forms; wants are the Prettier-canonical broken forms.
//
// @evidence contracts/testing.md#behavioral-verification Three subcases run the in-process `format` command on flat over-width declarations (a two-specifier import, a two-specifier re-export, and a two-short-specifier re-export with a long module tail) and require the exact broken output with one specifier per line.
// @evidence contracts/testing.md#independent-expectations Each expected output is an authored literal that keeps the same bindings, order and module path and changes only braces, separators and breaks to the Prettier layout.
// @evidence contracts/testing.md#distinguishing-cases These are the changed-input twins of the single-specifier inline cases: a clause with two specifiers must still break past 80 columns, including when only the `from` tail overflows. The default-plus-single case named in the comment is owned by the default-import test; the unchanged singles are owned by TestCommandFormatSingleSpecifierStaysInline.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
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
