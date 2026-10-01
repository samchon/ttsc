package linthost

import "testing"

// TestFixDotNotationKeepsBracketForReservedWordKey verifies a reserved-
// word key (`box["class"]`) is detected but NOT rewritten.
//
// Even though modern parsers accept dot access to keywords, minifiers
// and older engines can break — the safe choice is to keep bracket
// syntax for reserved-word keys, mirroring ESLint's
// `allowKeywords: false` mode. This pin is independent of the main
// rewrite branch and exercises the "detect but impose nothing" arm; the
// rewrite is still offered as an opt-in suggestion, pinned by
// `TestDotNotationOffersReservedWordCollapseAsSuggestion`.
//
// 1. Snapshot `box["class"]`.
// 2. Enable `dot-notation`.
// 3. Assert the rule fires but emits no fix snapshot.
//
// @evidence contracts/testing.md#behavioral-verification The reserved-word access must produce a finding while automatic application leaves its original source byte-identical.
// @evidence contracts/testing.md#independent-expectations The supported conservative keyword policy withholds imposed edits; the original source is the independently established unchanged oracle.
// @evidence contracts/testing.md#distinguishing-cases class is the withheld keyword boundary. TestFixDotNotationRewritesBracketToDotForIdentifierKey owns normal identifiers and TestDotNotationOffersReservedWordCollapseAsSuggestion owns author-approved rewriting.
// @evidence contracts/testing.md#execution-ownership TestFixDotNotationKeepsBracketForReservedWordKey owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestFixDotNotationKeepsBracketForReservedWordKey(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "dot-notation",
    "const box: any = { class: \"ttsc\" };\nconst value = box[\"class\"];\nJSON.stringify(value);\n",
  )
}
