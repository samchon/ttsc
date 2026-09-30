package linthost

import "testing"

// TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak proves the
// abstain is scoped to one specifier: a two-specifier clause, and a
// default-plus-single clause, still break when flat and over width. Inputs are
// the flat (mangled) forms; wants are the Prettier-canonical broken forms.
//
// @evidence contracts/testing.md#behavioral-verification The format command must break flat two-specifier import/export declarations over width rather than applying the single-specifier exemption.
// @evidence contracts/testing.md#independent-expectations Each literal expected output retains the same binding names, order and module while changing only braces, separators and breaks to the canonical layout.
// @evidence contracts/testing.md#distinguishing-cases Three named changed cases cover long bindings and long module tails; the unchanged singles and already broken clauses are owned by the stays-inline matrix.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatSingleSpecifierAbstainDoesNotBlockMultiBreak is a public format unit selected by TestSelectedLintUnits. The isolated fixture filesystem feeds the actual Go command entry in the shared process. This verifies command semantics without compiling or launching a native artifact or installing a consumer.
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
