package linthost

import "testing"

// TestFormatClauseJoinHoistsAcrossAMultilineTemplateWithoutMovingIt verifies a hoisted
// body joins while the lines inside a template literal keep their exact bytes.
//
// The newlines inside a template carry string content, so the column shift must
// step over them while still joining the label-to-call gap. The complete
// independent output detects either refusing this supported join or changing
// its template payload. This direct rule case does not run the format cascade
// or obtain external formatter output.
//
//  1. Parse a label whose body passes a multi-line template literal.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the label joins and the template's own bytes are unchanged.
//
// @evidence contracts/testing.md#behavioral-verification The owning clause-join rule must move run onto the label line while preserving every byte of the multiline template. Complete literal output catches either abandoning the join or shifting template content.
// @evidence contracts/testing.md#independent-expectations Template interior newlines are string payload, while the label-to-call gap is layout. The supported label layout and unchanged a-newline-b payload independently determine the expected source.
// @evidence contracts/testing.md#distinguishing-cases This positive joins a multiline labeled expression whose continuation starts inside a value template. LeavesATemplateLiteralTypeUntouched covers the separate type-position form, and LeavesAStringContinuationUntouched covers ordinary strings.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinHoistsAcrossAMultilineTemplateWithoutMovingIt owns the literal transformation fixture in the public Go unit population. The syntax-only harness runs clause-join and applies its edits in the same process without installation, native artifact production or a real product host.
func TestFormatClauseJoinHoistsAcrossAMultilineTemplateWithoutMovingIt(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\n  run(`a\nb`);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: run(`a\nb`);\n",
  )
}
