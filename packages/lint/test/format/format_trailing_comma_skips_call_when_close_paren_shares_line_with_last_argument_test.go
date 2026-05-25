package linthost

import "testing"

// TestFormatTrailingCommaSkipsCallWhenCloseParenSharesLineWithLastArgument
// verifies the rule leaves the trailing comma off when a multi-line argument
// shares its closing line with the call's `)`.
//
// Prettier's `trailingComma: "all"` keys the comma on whether the close
// bracket lands on its own line, not on whether the list contains a newline
// somewhere. `JSON.stringify({\n  ...\n})` is the canonical shape where
// `}` and `)` collapse onto one line. Without narrowing the multi-line check
// to `last.End()..closeBracketPos` the rule would emit the syntactically
// valid but stylistically wrong `},)`. Pinning this branch at the Go-unit
// layer keeps a future refactor that widens the boundary back to
// `list.Pos()..closeBracketPos` from regressing silently — the slow e2e
// fixture would catch it, but only after a full launcher spawn.
//
//  1. Parse a source file with one multi-line call whose sole argument is a
//     multi-line object literal whose closing `}` shares a line with `)`.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Assert zero findings — neither the call nor the already-terminated
//     object literal contribute an edit.
func TestFormatTrailingCommaSkipsCallWhenCloseParenSharesLineWithLastArgument(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "JSON.stringify({\n  a: 1,\n  b: 2,\n});\n",
  )
}
