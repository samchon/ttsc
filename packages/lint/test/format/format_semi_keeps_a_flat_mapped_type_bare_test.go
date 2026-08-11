package linthost

import "testing"

// TestFormatSemiKeepsAFlatMappedTypeBare is the negative twin of the broken
// mapped-type insert: a flat mapped type takes no terminator, and one
// already terminated takes no second finding.
//
// Prettier decides a mapped type's wrap the way it decides an object
// type's, by the line terminator between `{` and what follows it, and
// prints the terminator inside an `ifBreak` keyed on that wrap. So the
// closing brace's own position is not the question: Prettier 3.8.3 returns
// `type Wrapped = { [K in string]: string\n};` as the one-line
// `type Wrapped = { [K in string]: string };`, with nothing after `string`,
// and terminating it here would emit a `;` the oracle never prints. The
// already-terminated case is the idempotency guard the format cascade needs.
//
//  1. Parse a one-line mapped type, a flat-opened one whose brace fell to
//     the next line, and a broken one already carrying its `;`.
//  2. Run format/semi with default options.
//  3. Assert the rule reports nothing.
func TestFormatSemiKeepsAFlatMappedTypeBare(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/semi",
    "type Flat = { [K in string]: string };\n"+
      "type Wrapped = { [K in string]: string\n};\n"+
      "type Done = {\n  [K in string]: string;\n};\n",
  )
}
