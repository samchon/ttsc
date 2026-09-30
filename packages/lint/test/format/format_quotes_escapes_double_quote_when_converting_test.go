package linthost

import "testing"

// TestFormatQuotesEscapesDoubleQuoteWhenConverting verifies the required quote conversion.
//
// The mixed payload has one required escape with either delimiter.
// Choosing the default double form must introduce its double-quote escape
// and remove the apostrophe escape without changing the cooked value.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must escape the embedded double quote and unescape the apostrophe when the mixed single-quoted payload converts to double quotes.
// @evidence contracts/testing.md#independent-expectations The literal output encodes the same cooked a"b'c value with the new delimiter, preserving the declaration and JSON.stringify call; the ECMAScript string spelling requires the new double-quote escape.
// @evidence contracts/testing.md#distinguishing-cases This one-versus-one escape tie changes to the default delimiter; unescaped-double negatives own the strictly more-expensive conversion and the apostrophe-only case owns removal without a new quote escape.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesEscapesDoubleQuoteWhenConverting is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesEscapesDoubleQuoteWhenConverting(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/quotes",
    "const mixed = 'a\"b\\'c';\nJSON.stringify(mixed);\n",
    "const mixed = \"a\\\"b'c\";\nJSON.stringify(mixed);\n",
  )
}
