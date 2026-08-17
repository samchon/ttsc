package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a heading deeper than the unit model is scanned rather than fatal.
 *
 * `headingUnitIDs` is indexed by heading level and sized to hold every materializable one, H1 through H4, and the digest-host walk read from the heading's own level with no upper clamp. An H5 started at the last valid slot and survived by one; an H6 started past the end and panicked, taking the whole rule down before it materialized anything. The shape is ordinary Markdown, and only keeping the document out of the scanned population avoided it: the crash precedes the symbol selector and every tag, and for a document inside a claim's own `files` it precedes activation too, since the claim populations are scanned first.
 *
 *  1. Scan a document whose deepest heading is an H6 nested under real units.
 *  2. Assert the scan completes and materializes the file unit with its H1 through H4 sections, and nothing deeper.
 *  3. Assert an H6 answers as an H5 already does, for attribution and for a tag written under it.
 */
func TestMarkdownSurvivesAHeadingBelowTheUnitModel(t *testing.T) {
  document := "# Spec {#spec}\n\n## Pricing {#pricing}\n\n### Coupons {#coupons}\n\n#### Limits {#limits}\n\n##### Deeper\n\n###### Deepest\n\nBody under the deepest heading.\n"
  inventory, problems := scanProjectMarkdown("docs/spec.md", document)
  if len(problems) != 0 {
    t.Fatalf("a heading below the unit model must raise nothing on its own: %v", problems)
  }
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  want := "docs/spec.md,docs/spec.md#spec,docs/spec.md#pricing,docs/spec.md#coupons,docs/spec.md#limits"
  if got := strings.Join(targets, ","); got != want {
    t.Fatalf("Markdown units = %q, want %q", got, want)
  }

  // Attribution follows the same rule an H5 already obeys: the region belongs to
  // the nearest unit that encloses it, which is the H4 here.
  edited := strings.Replace(document, "Body under the deepest heading.", "Rewritten body.", 1)
  if edited == document {
    t.Fatal("the edit did not reach the body under the deepest heading")
  }
  if markdownUnitDigest(t, document, "docs/spec.md#limits") ==
    markdownUnitDigest(t, edited, "docs/spec.md#limits") {
    t.Fatal("text under an H6 reached no enclosing unit, so a citation of the H4 never expires")
  }
  if markdownUnitDigest(t, document, "docs/spec.md#coupons") !=
    markdownUnitDigest(t, edited, "docs/spec.md#coupons") {
    t.Fatal("text under an H6 was attributed past its nearest enclosing unit")
  }
  // The same comparison for an H5, so "an H6 answers exactly as an H5 already
  // did" is asserted rather than only stated.
  shallow := strings.Replace(document, "###### Deepest\n\n", "", 1)
  shallowEdited := strings.Replace(edited, "###### Deepest\n\n", "", 1)
  if shallow == document || shallowEdited == edited {
    t.Fatal("the H6 was not removed, so this arm repeats the H6 case rather than testing an H5")
  }
  if markdownUnitDigest(t, shallow, "docs/spec.md#limits") ==
    markdownUnitDigest(t, shallowEdited, "docs/spec.md#limits") {
    t.Fatal("text under an H5 reached no enclosing unit")
  }
  if markdownUnitDigest(t, shallow, "docs/spec.md#coupons") !=
    markdownUnitDigest(t, shallowEdited, "docs/spec.md#coupons") {
    t.Fatal("text under an H5 was attributed past its nearest enclosing unit")
  }

  // A tag under one is refused on its own kind, which is the answer an H5 gives
  // and the reason neither needs a unit to be safe.
  for _, deep := range []struct {
    heading string
    kind    string
  }{
    {heading: "##### Deeper", kind: "h5"},
    {heading: "###### Deepest", kind: "h6"},
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/rules.md": "## Only {#only}\n",
      "plans/alpha.md": `## Section one {#section-one}

<!-- @evidence docs/rules.md#only Alpha honors it. -->

` + deep.heading + `

<!-- @evidence docs/rules.md#only Written below the deep heading. -->
`,
    }, `{"claims":[{
      "type":"markdown",
      "files":["plans/**"],
      "symbol":"h2",
      "reference":{"type":"markdown","files":["docs/rules.md"],"symbol":"h2"}
    }]}`)
    assertProblemContains(t, messages, "Out-of-scope @evidence host at plans/alpha.md:7")
    assertProblemContains(t, messages, "host kind '"+deep.kind+"' is not selected")
  }
}
