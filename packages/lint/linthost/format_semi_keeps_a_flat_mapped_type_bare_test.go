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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must offer no insertion for flat-opened mapped clauses, including a later closing brace, and no duplicate insertion for an already-terminated broken clause.
// @evidence contracts/testing.md#independent-expectations The independent literal fixtures specify wrap at the opening brace and canonical termination; a closing-brace newline alone does not make the clause broken.
// @evidence contracts/testing.md#distinguishing-cases Flat singleton, flat-opened/later-closed and broken-already-terminated cases share this host; broken unterminated mapped-type positives ensure this is not an unconditional no-op oracle.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsAFlatMappedTypeBare is a public Go unit selected by TestSelectedLintUnits. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and observes zero findings in the same process without a consumer install, native product build or host execution.
func TestFormatSemiKeepsAFlatMappedTypeBare(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/semi",
    "type Flat = { [K in string]: string };\n"+
      "type Wrapped = { [K in string]: string\n};\n"+
      "type Done = {\n  [K in string]: string;\n};\n",
  )
}
