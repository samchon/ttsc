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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must terminate a mapped clause opened on a new line while leaving a flat-opened clause bare even if its closing brace occupies the next line.
// @evidence contracts/testing.md#independent-expectations The independent full output preserves both mappings and applies the opening-brace wrap convention, so closing-brace position cannot supply the expected answer.
// @evidence contracts/testing.md#distinguishing-cases The half-wrapped pair shares one fixture: opened-broken gains a semicolon while opened-flat remains unchanged, distinguishing wrap ownership from any-multiline heuristics.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiReadsAMappedTypesWrapAtItsOpeningBrace is a public Go unit selected by TestSelectedLintUnits. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
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
