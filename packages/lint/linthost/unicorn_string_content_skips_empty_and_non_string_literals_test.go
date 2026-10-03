package linthost

import "testing"

// TestUnicornStringContentSkipsEmptyAndNonStringLiterals verifies the
// falsy-value and string-type guards from upstream's getProblem.
//
// Upstream bails when the candidate value is not a truthy string: empty
// string literals and empty quasis never report (even for a pattern that
// matches the empty string), and numeric/boolean/regex literals are skipped
// even when their SOURCE text would match — the rule reads cooked values,
// not raw tokens.
//
//  1. Lint an empty string and an empty template under an empty-matching
//     pattern and assert silence.
//  2. Lint `0`, `true`, a regex literal, and an identifier whose spelling
//     matches the pattern.
//  3. Assert zero findings for every arm.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSourceWithOptions executes the actual engine for every named source and requires zero findings, rejecting token-spelling-only matches.
// @evidence contracts/testing.md#independent-expectations The documented string-content target/value contract and official truthy-string guard exclude empty values and non-string AST nodes.
// @evidence contracts/testing.md#distinguishing-cases Empty strings, empty templates and empty boundary quasis stay accepted even under an empty-matching regex; numeric/boolean/regex/identifier spellings cannot substitute for string values.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentSkipsEmptyAndNonStringLiterals is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while the lint engine parses and checks authored sources in one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestUnicornStringContentSkipsEmptyAndNonStringLiterals(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    options string
  }{
    {name: "empty string literal", source: "const foo = '';\n", options: `{"patterns":{"^$":"filled"}}`},
    {name: "empty template literal", source: "const foo = ``;\n", options: `{"patterns":{"^$":"filled"}}`},
    {name: "empty boundary quasis", source: "declare const v: string;\nconst foo = `${v}`;\n", options: `{"patterns":{"^$":"filled"}}`},
    {name: "numeric literal", source: "const foo = 0;\n", options: `{"patterns":{"0":"zero"}}`},
    {name: "boolean literal", source: "const foo = true;\n", options: `{"patterns":{"true":"yes"}}`},
    {name: "regex literal", source: "const foo = /no/;\n", options: `{"patterns":{"no":"yes"}}`},
    {name: "identifier spelling", source: "declare const no: string;\nconst foo = no;\n", options: `{"patterns":{"no":"yes"}}`},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", test.source, test.options)
    })
  }
}
