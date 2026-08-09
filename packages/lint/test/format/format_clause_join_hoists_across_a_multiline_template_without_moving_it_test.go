package linthost

import "testing"

// TestFormatClauseJoinHoistsAcrossAMultilineTemplateWithoutMovingIt verifies a hoisted
// body joins while the lines inside a template literal keep their exact bytes.
//
// The newlines inside a template carry string content, so the column shift must
// step over them. Abandoning the whole join instead is strictly worse: the join
// is what `format/indent` keys off, so the body's interior moves anyway and the
// file settles on a hybrid layout Prettier never emits, which is the property
// the shift exists to remove. Prettier 3.8.3 joins this label and leaves the
// template untouched, and so does the rule.
//
//  1. Parse a label whose body passes a multi-line template literal.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the label joins and the template's own bytes are unchanged.
func TestFormatClauseJoinHoistsAcrossAMultilineTemplateWithoutMovingIt(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\n  run(`a\nb`);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: run(`a\nb`);\n",
  )
}
