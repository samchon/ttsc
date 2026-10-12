package evidence

import (
  "testing"
)

/**
 * TestHeadingAnnotationsEndAtStructureAndTags verifies where a heading
 * annotation's explanation ends.
 *
 * A heading of the section's own depth or shallower is the next part of the
 * surrounding document, while a deeper heading divides the explanation and
 * stays inside it. Any other annotation, in either form, starts its own. A line
 * opening another tool's tag ends the explanation exactly where it ends a
 * line-form reason: in a JSDoc block, never inside a Markdown HTML comment. A
 * line-form reason keeps its continuation, so an untagged heading under it is
 * still part of it.
 *
 *  1. Parse one documentation body per boundary.
 *  2. Require the exact targets and explanations on each side of it.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations and parseReviews run on Markdown-comment bodies and JSDoc blocks whose heading sections meet a peer heading, a parent heading, a deeper heading, a line-form tag, a heading-form tag, a review in each form, `@param` and a non-JSDoc `@architecture` line; every subtest compares the parsed targets and reasons or descriptions with literals.
 * @evidence contracts/testing.md#independent-expectations Each expected explanation is written from the section grammar: same-or-shallower headings and any annotation end a section, deeper headings stay, another tool's tag ends it only where tag boundaries apply, and a line-form reason is unchanged by headings.
 * @evidence contracts/testing.md#distinguishing-cases Peer versus parent versus deeper headings separate the depth comparison; line versus heading openers in both orders separate the two forms; review-closes-citation and citation-closes-review cover both parsers; JSDoc versus HTML-comment bodies decide the tag boundary; the untagged heading under a line form pins legacy continuation.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsEndAtStructureAndTags is a native Go unit entry; its subtests parse in-memory strings in the test process without a graph, filesystem or product host.
 */
func TestHeadingAnnotationsEndAtStructureAndTags(t *testing.T) {
  type acknowledgement struct {
    target string
    reason string
  }
  for _, scenario := range []struct {
    name     string
    body     string
    expected []acknowledgement
  }{
    {"peer heading", "## @evidence a.md#x\nReason.\n## Ordinary\nOutside.", []acknowledgement{{"a.md#x", "Reason."}}},
    {"parent heading", "### @evidence a.md#x\nReason.\n## Parent\nOutside.", []acknowledgement{{"a.md#x", "Reason."}}},
    {"deeper heading", "## @evidence a.md#x\nReason.\n### Detail\nMore.", []acknowledgement{{"a.md#x", "Reason.\n### Detail\nMore."}}},
    {"line form after a section", "## @evidence a.md#x\nReason.\n@evidence b.md Line reason.\nMore line.", []acknowledgement{{"a.md#x", "Reason."}, {"b.md", "Line reason.\nMore line."}}},
    {"section after a line form", "@evidence b.md Line reason.\n### @evidence a.md#x\nReason.", []acknowledgement{{"b.md", "Line reason."}, {"a.md#x", "Reason."}}},
    {"line form keeps an untagged heading", "@evidence b.md Line reason.\n## Notes\nMore.", []acknowledgement{{"b.md", "Line reason.\n## Notes\nMore."}}},
    {"nested section", "## @evidence a.md#x\nReason.\n### @evidenceExclude c.md\nNot here.", []acknowledgement{{"a.md#x", "Reason."}, {"c.md", "Not here."}}},
    {"review heading closes a citation", "## @evidence a.md#x\nReason.\n## @evidenceReview a.md#x Checked.\nMore checking.", []acknowledgement{{"a.md#x", "Reason."}}},
    {"another tool's tag in an HTML comment body", " ## @evidence a.md#x\n Reason.\n @architecture approved this\n", []acknowledgement{{"a.md#x", "Reason.\n@architecture approved this"}}},
    {"another tool's tag in JSDoc", "/**\n * ## @evidence a.md#x\n * Reason.\n * @param input The input.\n */", []acknowledgement{{"a.md#x", "Reason."}}},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      declarations := parseDeclarations(scenario.body)
      if len(declarations) != len(scenario.expected) {
        t.Fatalf("got %#v, want %#v", declarations, scenario.expected)
      }
      for index, expected := range scenario.expected {
        if declarations[index].Target != expected.target || declarations[index].Reason != expected.reason {
          t.Fatalf("acknowledgement %d: got %#v, want %#v", index, declarations[index], expected)
        }
      }
    })
  }

  t.Run("review heading keeps its own description", func(t *testing.T) {
    reviews := parseReviews("## @evidence a.md#x\nReason.\n## @evidenceReview a.md#x Checked.\nMore checking.\n## @evidence b.md Next.\nNot a description.")
    if len(reviews) != 1 || reviews[0].Target != "a.md#x" || reviews[0].Description != "Checked.\nMore checking." {
      t.Fatalf("a citation heading must close the review above it: %#v", reviews)
    }
  })
  t.Run("line-form citation closes a review section", func(t *testing.T) {
    reviews := parseReviews("### @evidenceExcludeReview a.md#x\nConfirmed.\n@evidence b.md Next.")
    if len(reviews) != 1 || reviews[0].Reviews != tagExclude || reviews[0].Description != "Confirmed." {
      t.Fatalf("a line-form citation must close the review section above it: %#v", reviews)
    }
  })
}
