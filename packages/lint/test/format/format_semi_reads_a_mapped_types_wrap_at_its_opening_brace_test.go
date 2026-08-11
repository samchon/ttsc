package linthost

import "testing"

// TestFormatSemiReadsAMappedTypesWrapAtItsOpeningBrace verifies the two
// half-wrapped mapped types come out opposite ways round.
//
// Prettier preserves a mapped type's wrap by the line terminator between
// its `{` and the clause, exactly as it preserves an object type's, so the
// closing brace's own position never enters the decision. The pair below is
// what separates that rule from "the body spans lines": Prettier 3.8.3
// returns `type Opened = {\n  [K in string]: string };` terminated (it
// breaks, then moves the brace) and `type Closed = { [K in string]: string\n};`
// flat and bare. Reading the `}` instead would answer both backwards.
//
//  1. Parse a mapped type broken at its `{` but closed on the clause's
//     line, and one opened flat but closed on the next line.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert only the one broken at its `{` gains a `;`.
func TestFormatSemiReadsAMappedTypesWrapAtItsOpeningBrace(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type Opened = {\n  [K in string]: string };\n"+
      "type Closed = { [K in string]: string\n};\n",
    "type Opened = {\n  [K in string]: string; };\n"+
      "type Closed = { [K in string]: string\n};\n",
  )
}
