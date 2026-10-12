package evidence

import (
  "testing"
)

/**
 * TestMarkdownAnnotationHeadingsReadThroughCommentsAndUnaddressablePaths
 * verifies a visible annotation heading is decided by the same heading view as
 * the outline, in two spellings that view treats specially.
 *
 * A comment before the tag in a heading's title is masked out of the heading
 * view, so the title still opens with the tag and the heading opens an
 * annotation; the comment itself carries nothing. A file whose path contains
 * whitespace materializes no unit at all, but its annotations are still read
 * and land on the same host its comments do, so the diagnostics that follow
 * name them rather than losing them silently.
 *
 *  1. Scan a document whose H3 title opens with a comment before the tag.
 *  2. Scan a document at a whitespace path with a comment citation and an H2
 *     annotation before any heading.
 *  3. Require each declaration's target, reason and host.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown inventories `docs/plan.md` whose `### <!-- note --> @evidence docs/a.md#x` section sits under `## Req`, and `docs/my plan.md` whose comment citation and `## @evidence docs/a.md#y` section sit before any heading; the case compares targets, reasons, HostIDs and host symbols, and requires the whitespace path to report its rename problem and materialize no unit.
 * @evidence contracts/testing.md#independent-expectations The outline's heading view masks comments, so the title opens with the tag; an unaddressable path has no units but keeps its hosts, so the comment and the annotation share the file host by the ownership rule.
 * @evidence contracts/testing.md#distinguishing-cases A comment inside a title versus a comment as its own block, and an addressable versus an unaddressable path, each against the ownership the comment form already has in the same position.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationHeadingsReadThroughCommentsAndUnaddressablePaths is a native Go unit entry; scanProjectMarkdown runs the Markdown scanner on in-memory content in the test process with no graph or product host.
 */
func TestMarkdownAnnotationHeadingsReadThroughCommentsAndUnaddressablePaths(t *testing.T) {
  t.Run("comment before the tag", func(t *testing.T) {
    inventory, problems := scanProjectMarkdown("docs/plan.md", "# Plan\n\n## Req {#req}\n\nBody.\n\n### <!-- note --> @evidence docs/a.md#x\n\nAnswers the requirement.\n")
    if len(problems) != 0 || len(inventory.Unreadable) != 0 || len(inventory.Units) != 3 {
      t.Fatalf("unexpected scan: problems=%v unreadable=%v units=%v", problems, inventory.Unreadable, inventory.Units)
    }
    if len(inventory.Declarations) != 1 {
      t.Fatalf("expected the one annotation, got %#v", inventory.Declarations)
    }
    declaration := inventory.Declarations[0]
    if declaration.Target != "docs/a.md#x" || declaration.Reason != "Answers the requirement." ||
      declaration.HostID != inventory.Units[2].ID || !declaration.Hosts["h2"] {
      t.Fatalf("the annotation lost its text or owner: %#v", declaration)
    }
  })
  t.Run("unaddressable path", func(t *testing.T) {
    inventory, problems := scanProjectMarkdown("docs/my plan.md", "Intro.\n\n<!-- @evidence docs/a.md#comment Comment reason. -->\n\n## @evidence docs/a.md#y\n\nHeading reason.\n")
    if len(problems) != 1 || len(inventory.Units) != 0 {
      t.Fatalf("a whitespace path reports its rename and materializes nothing: problems=%v units=%v", problems, inventory.Units)
    }
    if len(inventory.Declarations) != 2 {
      t.Fatalf("both annotations must still be read: %#v", inventory.Declarations)
    }
    comment, heading := inventory.Declarations[0], inventory.Declarations[1]
    if comment.Target != "docs/a.md#comment" || heading.Target != "docs/a.md#y" || heading.Reason != "Heading reason." ||
      heading.HostID != comment.HostID || !heading.Hosts["file"] || !comment.Hosts["file"] {
      t.Fatalf("the heading annotation must share the comment's host: comment=%#v heading=%#v", comment, heading)
    }
  })
}
