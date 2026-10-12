package evidence

import (
  "strings"
  "testing"
)

/**
 * TestMarkdownCommentHeadingAnnotationsBelongToTheEnclosingHeading verifies a
 * heading-form annotation inside a Markdown HTML comment is metadata of the
 * heading that encloses the comment.
 *
 * The heading inside the comment renders nowhere, so it must never become a
 * heading unit an implementation would owe, and its section reads exactly as
 * it would in a documentation comment: the citation and the heading-form
 * review below it answer for the heading the comment sits under. Writing the
 * comment must not move that heading's digest.
 *
 *  1. Scan a document whose H2 holds a comment with a heading-form citation and
 *     a heading-form review, and the same document without the comment.
 *  2. Require the same three units and the same H2 digest in both.
 *  3. Require the citation and the review on the H2, with their target,
 *     reason, fingerprint and description.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown inventories a document whose `## Req` section holds an HTML comment with `## @evidence ideas.md#x` and `### @evidenceReview ideas.md#x #abcdef0` sections, and the same document without it; the case compares unit targets and digests, then the declaration's HostID, host symbol, target and reason and the review's host, target, fingerprint and description with literals.
 * @evidence contracts/testing.md#independent-expectations Comments are tag positions and never headings of the outline, so the unit set and the H2 digest must equal the comment-free document; the shared grammar fixes the section's reason and the review's fingerprint and description from the authored text.
 * @evidence contracts/testing.md#distinguishing-cases A heading-form citation and a heading-form review sharing one comment, against the same document without the comment; the visible heading form is owned by the Markdown annotation-heading entries.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownCommentHeadingAnnotationsBelongToTheEnclosingHeading is a native Go unit entry; scanProjectMarkdown runs the Markdown scanner on in-memory content in the test process with no graph or product host.
 */
func TestMarkdownCommentHeadingAnnotationsBelongToTheEnclosingHeading(t *testing.T) {
  comment := "<!--\n## @evidence ideas.md#x\n\nExplanation inside the comment.\n\n### @evidenceReview ideas.md#x #abcdef0\n\nChecked the note.\n-->\n"
  plain := "# Doc\n\n## Req {#req}\n\nBody.\n"
  annotated := plain + "\n" + comment
  outline := func(content string) (*artifactInventory, string) {
    inventory, problems := scanProjectMarkdown("docs/req.md", content)
    if len(problems) != 0 || len(inventory.Unreadable) != 0 {
      t.Fatalf("unexpected problems: %v %v", problems, inventory.Unreadable)
    }
    rendered := []string{}
    for _, unit := range inventory.Units {
      rendered = append(rendered, unit.Target+" "+unit.Digest)
    }
    return inventory, strings.Join(rendered, "\n")
  }
  _, before := outline(plain)
  inventory, after := outline(annotated)
  if before != after {
    t.Fatalf("the comment changed the outline or a digest:\nplain:\n%s\nannotated:\n%s", before, after)
  }
  var req *evidenceUnit
  for _, unit := range inventory.Units {
    if unit.Target == "docs/req.md#req" {
      req = unit
    }
  }
  if req == nil || len(inventory.Declarations) != 1 || len(inventory.Reviews) != 1 {
    t.Fatalf("expected one citation and one review under #req: units=%v declarations=%v reviews=%v", inventory.Units, inventory.Declarations, inventory.Reviews)
  }
  declaration, review := inventory.Declarations[0], inventory.Reviews[0]
  if declaration.HostID != req.ID || !declaration.Hosts["h2"] || len(declaration.Hosts) != 1 ||
    declaration.Target != "ideas.md#x" || declaration.Reason != "Explanation inside the comment." {
    t.Fatalf("the comment citation lost its owner or text: %#v", declaration)
  }
  if len(review.SemanticHostIDs) != 1 || review.SemanticHostIDs[0] != req.ID || review.Target != "ideas.md#x" ||
    review.Fingerprint != "abcdef0" || review.Description != "Checked the note." {
    t.Fatalf("the comment review lost its owner or text: %#v", review)
  }
}
