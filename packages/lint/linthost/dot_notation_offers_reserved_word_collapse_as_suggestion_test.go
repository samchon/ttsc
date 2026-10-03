package linthost

import "testing"

// TestDotNotationOffersReservedWordCollapseAsSuggestion verifies a reserved-
// word key reports with an opt-in `box.class` rewrite instead of no action.
//
// ESLint's default `allowKeywords: true` rewrites keyword keys outright; this
// port stays stricter because `obj.class` can still trip old engines and
// minifiers. That conservatism is a reason not to impose the edit, not a
// reason to withhold it: the rewrite is syntactically valid on every modern
// target, so the author gets to decide.
//
//  1. Report on `box["class"]` and assert nothing is applied automatically.
//  2. Assert the single suggestion names the keyword and yields `box.class`.
//  3. Assert the non-reserved twin `box["name"]` is still autofixed outright.
//
// @evidence contracts/testing.md#behavioral-verification The keyword access has exactly one diagnostic and suggestion with the authored title, zero automatic edits, and the exact box.class suggested result; a normal name key fixes automatically.
// @evidence contracts/testing.md#independent-expectations The literal suggestion title and expected source encode the opt-in keyword policy independently of emitted suggestion data.
// @evidence contracts/testing.md#distinguishing-cases Reserved class differs from nonreserved name; both the automatic no-change pass and explicit suggestion application are asserted.
// @evidence contracts/testing.md#execution-ownership TestDotNotationOffersReservedWordCollapseAsSuggestion owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestDotNotationOffersReservedWordCollapseAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "dot-notation",
    "const box: any = { class: \"ttsc\" };\nconst value = box[\"class\"];\nJSON.stringify(value);\n",
    "Use dot notation for the reserved word `class`.",
    "const box: any = { class: \"ttsc\" };\nconst value = box.class;\nJSON.stringify(value);\n",
  )
  assertFixSnapshot(
    t,
    "dot-notation",
    "const box: any = { name: \"ttsc\" };\nconst value = box[\"name\"];\nJSON.stringify(value);\n",
    "const box: any = { name: \"ttsc\" };\nconst value = box.name;\nJSON.stringify(value);\n",
  )
}
