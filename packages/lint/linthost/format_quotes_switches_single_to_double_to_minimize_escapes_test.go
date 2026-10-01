package linthost

import "testing"

// TestFormatQuotesSwitchesSingleToDoubleToMinimizeEscapes verifies the required quote conversion.
//
// The apostrophe payload requires one escape with single quotes and none
// with double quotes. The lower escape cost must override prefer:single.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must switch an escaped apostrophe literal to double quotes even under prefer:single.
// @evidence contracts/testing.md#independent-expectations The complete output literal preserves the one-apostrophe cooked value and declaration while removing its required escape; the supported minimum-escape policy outranks the preferred delimiter.
// @evidence contracts/testing.md#distinguishing-cases This strict-cost positive is the symmetric option override; the plain prefer:single positive owns the tie branch and redundant-escape negatives own already-cheaper spellings.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesSwitchesSingleToDoubleToMinimizeEscapes is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesSwitchesSingleToDoubleToMinimizeEscapes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quotes",
    `const s = '\'';`+"\n",
    `{"prefer":"single"}`,
    `const s = "'";`+"\n",
  )
}
