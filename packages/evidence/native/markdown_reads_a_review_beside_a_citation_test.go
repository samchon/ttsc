package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown review is read rather than swallowed into the citation's
 * reason.
 *
 * An Individual Self-Review caught this. `parseCommentDeclarations` closes a
 * declaration at any other line-opening `@tag` only when tag boundaries are on,
 * and Markdown passed them off. So a review written under a citation inside one
 * HTML comment disappeared and the citation's reason grew a sentence addressed to
 * a different question. JSDoc gets the boundary from its own syntax and Prisma
 * asks for it explicitly; Markdown had been left without it.
 *
 *  1. Scan a document whose HTML comment holds a citation and then a review.
 *  2. Assert the citation's reason stops at its own sentence.
 *  3. Assert the review was collected with its own target and description.
 */
func TestMarkdownReadsAReviewBesideACitation(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `# Pricing

<!--
@evidence docs/meetings/a.md#policy Carries the limit agreed in that meeting.
@evidenceReview docs/meetings/a.md#policy Read the minutes; the limit matches.
-->
`)
  assertNoProblems(t, problems)
  if len(inventory.Declarations) != 1 {
    t.Fatalf("expected one citation, got %d", len(inventory.Declarations))
  }
  if reason := inventory.Declarations[0].Reason; reason != "Carries the limit agreed in that meeting." {
    t.Fatalf("the review leaked into the citation's reason: %q", reason)
  }
  if len(inventory.Reviews) != 1 {
    t.Fatalf("expected one review, got %d", len(inventory.Reviews))
  }
  review := inventory.Reviews[0]
  if review.Target != "docs/meetings/a.md#policy" {
    t.Fatalf("unexpected review target: %q", review.Target)
  }
  if review.Description != "Read the minutes; the limit matches." {
    t.Fatalf("unexpected review description: %q", review.Description)
  }
}

/**
 * Verifies content under an unaddressable heading still reaches a digest.
 *
 * An Individual Self-Review caught this too. `markdownHeading` accepts levels 1
 * to 6 and advances the current host unconditionally, while a unit is only
 * created for H1 to H4 with a resolvable anchor. The excluded cases named a host
 * ID no unit carried, so their lines accumulated in a bucket nothing read:
 * rewriting an `##### Details` section under a cited H4 changed no digest and
 * expired no review. Those lines belong to the nearest ancestor that is a unit,
 * which is the unit a citation of that region actually names.
 *
 *  1. Scan a document with an H2 containing an H5 subsection.
 *  2. Rewrite only the H5's body.
 *  3. Assert the H2's digest changed.
 */
func TestMarkdownFoldsUnaddressableSectionsIntoTheirAncestor(t *testing.T) {
  digestOf := func(content string) string {
    inventory, _ := scanProjectMarkdown("docs/spec.md", content)
    for _, unit := range inventory.Units {
      if unit.Target == "docs/spec.md#pricing" {
        return unit.Digest
      }
    }
    t.Fatalf("expected a unit for the cited H2 in:\n%s", content)
    return ""
  }
  before := digestOf("## Pricing\n\nThe rate is capped.\n\n##### Details\n\nOne per issuer.\n")
  after := digestOf("## Pricing\n\nThe rate is capped.\n\n##### Details\n\nTwo per issuer.\n")
  if before == after {
    t.Fatal("content under an H5 belongs to no digest, so a citation of its parent never expires")
  }
}

/**
 * Verifies a comment opening mid-line is treated as a tag position.
 *
 * The declaration scan runs over the whole document with a regular expression, so
 * it finds a review after prose on the same line. Leaving that line in the digest
 * meant writing the review changed the digest its own fingerprint is checked
 * against, which is the non-terminating repair loop the exclusion exists to close.
 *
 *  1. Take the digest of a section with no tags.
 *  2. Add a mid-line review to the same section.
 *  3. Assert the digest did not move.
 */
func TestMarkdownExcludesAMidLineComment(t *testing.T) {
  digestOf := func(content string) string {
    inventory, _ := scanProjectMarkdown("docs/spec.md", content)
    for _, unit := range inventory.Units {
      if unit.Target == "docs/spec.md#pricing" {
        return unit.Digest
      }
    }
    t.Fatalf("expected a unit for the H2 in:\n%s", content)
    return ""
  }
  bare := digestOf("## Pricing\n\nThe rate is capped.\n")
  annotated := digestOf("## Pricing\n\nThe rate is capped. <!-- @evidenceReview docs/spec.md#pricing Checked the cap. -->\n")
  if bare != annotated {
    t.Fatal("a mid-line comment stays in the digest, so writing a review there invalidates it")
  }
  // The negative twin: only the comment span comes out, so the prose beside it
  // still counts. Dropping the whole line instead would make a real content
  // change on an annotated line expire nothing.
  changed := digestOf("## Pricing\n\nThe rate is lifted. <!-- @evidenceReview docs/spec.md#pricing Checked the cap. -->\n")
  if changed == annotated {
    t.Fatal("prose beside a comment is missing from the digest, so a content change there expires nothing")
  }
}
