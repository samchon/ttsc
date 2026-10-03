package linthost

import "testing"

// TestFormatQuotesConvertsDoubleToSinglePreservingApostropheEscape verifies the required quote conversion.
//
// Under prefer:single, the mixed value becomes cheaper with single quotes.
// The two double quotes lose their escapes, but the apostrophe must stay
// escaped under its new delimiter under the supported escape-cost policy.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must convert the double-quoted mixed payload under prefer:single while retaining the apostrophe escape required by the new delimiter.
// @evidence contracts/testing.md#independent-expectations The complete literal output spells the same cooked value a"b"c' with two bare double quotes and one escaped apostrophe; the independently specified spelling follows the required new-delimiter escaping.
// @evidence contracts/testing.md#distinguishing-cases This positive conversion owns two escaped doubles plus a redundant escaped apostrophe; redundant-escape abstention siblings distinguish a cheaper existing delimiter.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesConvertsDoubleToSinglePreservingApostropheEscape is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesConvertsDoubleToSinglePreservingApostropheEscape(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quotes",
    "const s = "+`"a\"b\"c\'"`+";\n",
    `{"prefer":"single"}`,
    "const s = "+`'a"b"c\''`+";\n",
  )
}
