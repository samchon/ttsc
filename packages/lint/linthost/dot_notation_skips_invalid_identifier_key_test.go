package linthost

import "testing"

// TestDotNotationSkipsInvalidIdentifierKey verifies a hyphenated key
// (`box["not-valid-key"]`) emits no diagnostic at all.
//
// Bracket access is the only valid spelling when the key is not a
// legal identifier, so the detection branch must NOT flag the access.
// This pin locks the detection-level filter independent of the fix
// path.
//
// 1. Snapshot `box["not-valid-key"]`.
// 2. Enable `dot-notation`.
// 3. Assert no findings emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine must emit zero findings for the hyphenated key, distinguishing detection suppression from merely withholding a fix.
// @evidence contracts/testing.md#independent-expectations not-valid-key cannot be spelled as a JavaScript dot identifier; the independent zero-finding expectation follows that grammar.
// @evidence contracts/testing.md#distinguishing-cases The hyphenated key owns the invalid-identifier boundary; TestFixDotNotationRewritesBracketToDotForIdentifierKey owns the reportable name-key twin.
// @evidence contracts/testing.md#execution-ownership TestDotNotationSkipsInvalidIdentifierKey owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestDotNotationSkipsInvalidIdentifierKey(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "dot-notation",
    "const box: any = { \"not-valid-key\": \"ttsc\" };\nconst value = box[\"not-valid-key\"];\nJSON.stringify(value);\n",
  )
}
