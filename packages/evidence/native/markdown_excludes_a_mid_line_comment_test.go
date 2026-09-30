package evidence

import (
  "testing"
)

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
 *  3. Assert the digest did not move, then change adjacent prose and require the digest to move.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanProjectMarkdown exercises this case. Verifies a comment opening mid-line is treated as a tag position.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Adding only the review comment must leave the pricing digest equal; changing adjacent prose must change it. The relational oracle checks exclusion and retained meaning without reproducing the hash.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Take the digest of a section with no tags. Add a mid-line review to the same section. Assert the digest did not move, then change adjacent prose and require the digest to move.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownExcludesAMidLineComment is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
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
