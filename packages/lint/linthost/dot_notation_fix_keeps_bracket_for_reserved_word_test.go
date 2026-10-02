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
//  1. Run `dot-notation` on `box["class"]` and assert exactly one finding.
//  2. Apply the rule's fixes and assert none is applied.
//  3. Assert the source is unchanged.
//
// @evidence contracts/testing.md#behavioral-verification The reserved-word access must produce a finding while automatic application leaves its original source byte-identical.
// @evidence contracts/testing.md#independent-expectations The supported conservative keyword policy withholds imposed edits; the original source is the independently established unchanged oracle.
// @evidence contracts/testing.md#distinguishing-cases class is the withheld keyword boundary. TestFixDotNotationRewritesBracketToDotForIdentifierKey owns normal identifiers and TestDotNotationOffersReservedWordCollapseAsSuggestion owns author-approved rewriting.
// @evidence contracts/testing.md#execution-ownership TestFixDotNotationKeepsBracketForReservedWordKey owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestFixDotNotationKeepsBracketForReservedWordKey(t *testing.T) {
  source := "const box: any = { class: \"ttsc\" };\nconst value = box[\"class\"];\nJSON.stringify(value);\n"
  if _, _, findings := runRuleFindingsSnapshot(t, "dot-notation", source, nil); len(findings) != 1 {
    t.Fatalf("dot-notation: findings = %d, want 1 (%+v)", len(findings), findings)
  }
  assertNoFixSnapshot(t, "dot-notation", source)
}
