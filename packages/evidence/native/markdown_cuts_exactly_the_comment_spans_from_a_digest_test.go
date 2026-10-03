package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown digest cuts the same spans the declaration scan reads as tags.
 *
 * The scan matches `<!-- ... -->` over the whole document, so a tag position can
 * open after prose, close before prose, or span lines, and a `<!--` that never
 * closes is no position at all. A digest that cut whole lines instead either kept
 * a review inside the digest it is checked against or dropped real prose, so a
 * content change next to a comment expired nothing.
 *
 *  1. Take the digest of a section whose prose is "capped".
 *  2. Add a multi-line review opened after prose and require the digest to stay equal.
 *  3. Change prose after a leading comment, after a closing marker, and below an unclosed marker, and require each digest to move.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown computes real unit digests for each comment shape; a review written across lines leaves the digest unchanged while prose beside or after a comment, and under an unclosed marker, changes it.
 *
 * @evidence contracts/testing.md#independent-expectations The oracle is relational: equality when only a tag position is added, inequality when only prose differs. It follows from what a digest must exclude and retain, not from computing the hash.
 *
 * @evidence contracts/testing.md#distinguishing-cases The multi-line review opened after prose is the positive exclusion; prose after a leading comment, after a closing marker and under an unclosed marker are the negative arms where the content must keep counting.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownCutsExactlyTheCommentSpansFromADigest is the selectable Go entry and invokes scanProjectMarkdown on authored strings in the native Go process, with no installed consumer, compiled host or loader process.
 */
func TestMarkdownCutsExactlyTheCommentSpansFromADigest(t *testing.T) {
  digestOf := func(content string) string {
    return markdownUnitDigest(t, content, "docs/spec.md#pricing")
  }
  bare := digestOf("## Pricing\n\nThe rate is capped.\n")
  if bare != digestOf("## Pricing\n\nThe rate is capped. <!--\n@evidenceReview docs/spec.md#pricing Checked the cap.\n-->\n") {
    t.Fatal("the body of a comment opened after prose stays in the digest, so writing a review there invalidates it")
  }
  for name, pair := range map[string][2]string{
    "after a leading comment": {
      "## Pricing\n\n<!-- note --> The rate is capped.\n",
      "## Pricing\n\n<!-- note --> The rate is lifted.\n",
    },
    "after a closing marker": {
      "## Pricing\n\n<!--\nnote\n--> capped.\n",
      "## Pricing\n\n<!--\nnote\n--> lifted.\n",
    },
    "under an unclosed marker": {
      "## Pricing\n\n<!-- open\ncapped\n",
      "## Pricing\n\n<!-- open\nlifted\n",
    },
  } {
    if digestOf(pair[0]) == digestOf(pair[1]) {
      t.Fatalf("prose %s is missing from the digest, so a content change there expires nothing", name)
    }
  }
}
