package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownDigestIgnoresACommentParagraph verifies a comment written as a
// paragraph of its own leaves the digest of the section it sits in unchanged.
//
// Such a comment is set off by a blank line on each side. Dropping only the
// comment line would leave both blanks, so adding or deleting the comment would
// add or remove a blank line of the section and expire every review of it
// although no content moved.
//
// 1. Digest a section of two paragraphs.
// 2. Insert a review comment between them as its own paragraph, in LF and CRLF, and require the digest to stay equal.
// 3. Change a paragraph's prose and require the digest to move.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on a section with and without a standalone review comment and compares the unit digests it returns, covering LF and CRLF line endings.
// @evidence contracts/testing.md#independent-expectations The oracle is relational and follows from the digest contract that a tag position is excluded and a change to prose is not: adding only a comment paragraph keeps the digest equal, editing prose moves it, and neither depends on how the hash is computed.
// @evidence contracts/testing.md#distinguishing-cases The inserted paragraph is the positive exclusion in two line-ending forms; the edited second paragraph is the negative twin where the digest must move, so a digest that ignored everything near a comment fails.
// @evidence contracts/testing.md#execution-ownership TestMarkdownDigestIgnoresACommentParagraph is the selectable Go entry and calls scanMarkdownInventory through scanProjectMarkdown on authored strings in the native Go process, with no installed consumer, compiled host or filesystem.
func TestMarkdownDigestIgnoresACommentParagraph(t *testing.T) {
  bare := "## Pricing\n\nThe rate is capped.\n\nThe cap resets yearly.\n"
  annotated := "## Pricing\n\nThe rate is capped.\n\n<!-- @evidenceReview docs/spec.md#pricing Checked the cap. -->\n\nThe cap resets yearly.\n"
  want := markdownUnitDigest(t, bare, "docs/spec.md#pricing")
  if got := markdownUnitDigest(t, annotated, "docs/spec.md#pricing"); got != want {
    t.Fatal("a comment paragraph changes the digest through the blank lines around it")
  }
  crlf := strings.ReplaceAll(annotated, "\n", "\r\n")
  if got := markdownUnitDigest(t, crlf, "docs/spec.md#pricing"); got != want {
    t.Fatal("a comment paragraph changes the digest of a CRLF document")
  }
  edited := strings.Replace(annotated, "resets yearly", "resets monthly", 1)
  if got := markdownUnitDigest(t, edited, "docs/spec.md#pricing"); got == want {
    t.Fatal("prose after a comment paragraph is missing from the digest")
  }
}
