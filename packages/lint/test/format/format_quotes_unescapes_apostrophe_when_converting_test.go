package linthost

import "testing"

// TestFormatQuotesUnescapesApostropheWhenConverting verifies the conversion
// rewrites `\'` to bare `'` when wrapping with double quotes.
//
// The reverse of the unescaped-`"` case: `'don\'t'` has one escaped quote
// in the source. Converting to double quotes makes that escape unnecessary,
// so the rule should emit `"don't"`. Without this branch the formatter
// would produce valid-but-uglified `"don\'t"` output and reformat-twice
// could end up oscillating between forms.
//
//  1. Parse a source file with one escaped apostrophe in a single-quoted
//     literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the converted text drops the redundant backslash.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must remove the now-unnecessary apostrophe escape when converting the single-quoted phrase to double quotes.
// @evidence contracts/testing.md#independent-expectations The complete literal output retains the cooked don't value, declaration and JSON.stringify call; double delimiters require no apostrophe escape.
// @evidence contracts/testing.md#distinguishing-cases This escaped-apostrophe positive owns escape removal without an embedded double quote; the mixed conversion owns simultaneous removal and insertion, while canonical-double negatives own no edits.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesUnescapesApostropheWhenConverting is a public Go unit selected by TestSelectedLintUnits. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesUnescapesApostropheWhenConverting(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/quotes",
    "const phrase = 'don\\'t';\nJSON.stringify(phrase);\n",
    "const phrase = \"don't\";\nJSON.stringify(phrase);\n",
  )
}
