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
