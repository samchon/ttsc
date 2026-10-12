package evidence

import (
  "strings"
  "testing"
)

/**
 * TestMarkdownAnnotationSectionsLeaveTheOutlineAndDigests verifies a visible
 * annotation section is metadata: it adds no unit and changes no digest.
 *
 * A document can be a claim and a reference at once, as requirements citing
 * ideas while code cites the requirements. An annotation heading that became a
 * unit would add an obligation addressed by the slug of its tag and a child
 * whose arrival expires every review of the section above it. Its explanation,
 * including an ordinary heading and a comment inside it, is no unit's content
 * either, so writing or editing it must expire nothing, while an edit to the
 * section's own prose still must.
 *
 *  1. Scan a document without annotations and the same document with sections
 *     under each heading, one holding a deeper heading and a comment.
 *  2. Require identical units, parents and digests, including a heading that
 *     follows a section.
 *  3. Through the graph, require a review written against the plain document
 *     to survive the annotations and to expire on an ordinary prose edit.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown inventories the plain and the annotated document and the case compares every unit's target, symbol, parent target and digest; runIndexRule then runs graphRule.Check under requireReviewConfig with a review fingerprint read from the plain document and asserts silence for the annotated one and a stale review after an ordinary prose edit.
 * @evidence contracts/testing.md#independent-expectations Annotation sections are metadata by contract, so the annotated inventory must equal the plain one unit for unit; the review expectations follow the requireReview contract that only cited content moves a fingerprint.
 * @evidence contracts/testing.md#distinguishing-cases Sections under an H1 and an H2, a deeper ordinary heading and an HTML comment inside an explanation, and an ordinary H3 after a section whose parent must stay the H2; the ordinary prose edit is the positive control that digests still move.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationSectionsLeaveTheOutlineAndDigests is a native Go unit entry; scanProjectMarkdown and runIndexRule run the scanner and the graph rule in-process on temporary fixtures with no product host.
 */
func TestMarkdownAnnotationSectionsLeaveTheOutlineAndDigests(t *testing.T) {
  plain := "# Spec\n\nThe spec intro.\n\n## Pricing {#pricing}\n\nThe rate is capped at 30%.\n\n### Rounding {#rounding}\n\nRound half up.\n"
  annotated := "# Spec\n\nThe spec intro.\n\n" +
    "## @evidence ideas.md#spec\n\nThe whole spec follows the idea note.\n\n" +
    "## Pricing {#pricing}\n\nThe rate is capped at 30%.\n\n" +
    "### @evidence ideas.md#cap\n\nThe cap comes from the pricing idea.\n\n#### Background\n\n<!-- @evidenceReview ideas.md#cap Read the note. -->\n\nThe note names 30%.\n\n" +
    "### Rounding {#rounding}\n\nRound half up.\n"
  outline := func(content string) string {
    inventory, problems := scanProjectMarkdown("docs/spec.md", content)
    if len(problems) != 0 {
      t.Fatalf("unexpected scan problems: %v", problems)
    }
    targets := map[string]string{}
    for _, unit := range inventory.Units {
      targets[unit.ID] = unit.Target
    }
    rendered := []string{}
    for _, unit := range inventory.Units {
      rendered = append(rendered, unit.Target+" "+unit.Symbol+" parent="+targets[unit.ParentID]+" digest="+unit.Digest)
    }
    return strings.Join(rendered, "\n")
  }
  if before, after := outline(plain), outline(annotated); before != after {
    t.Fatalf("annotation sections changed the outline or a digest:\nplain:\n%s\nannotated:\n%s", before, after)
  }

  source := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #FINGERPRINT Read the cap.
 */
export interface ISale {
  price: number;
}
`
  bare := strings.Replace(source, " * @evidenceReview docs/spec.md#pricing #FINGERPRINT Read the cap.\n", "", 1)
  fingerprint := reviewedFingerprint(t, plain, bare)
  reviewed := strings.Replace(source, "FINGERPRINT", fingerprint, 1)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": annotated,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": strings.Replace(annotated, "capped at 30%", "capped at 45%", 1),
    "src/ISale.ts": reviewed,
  }, requireReviewConfig), "Stale @evidenceReview for 'docs/spec.md#pricing'")
}
