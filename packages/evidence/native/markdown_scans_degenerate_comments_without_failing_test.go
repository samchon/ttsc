package evidence

import "testing"

// TestMarkdownScansDegenerateCommentsWithoutFailing verifies the two comments
// HTML closes on their own opening marker are read as empty comments.
//
// `<!-->` and `<!--->` end where they start, so a scan that looked for the
// closing marker from the opening one counted the same dashes twice and sliced a
// negative-width body. They carry no tag, hide nothing after them, and are cut
// out of the digest like any other comment.
//
// 1. Scan a section whose prose is followed by each form and then by another heading.
// 2. Require the scan to finish, the following heading to materialize, and no declaration.
// 3. Require the digest to equal that of the same prose without the comment.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on a document holding each degenerate comment mid-line and reads the units, declarations and digest it returns; a panic or a missing following heading fails the case.
// @evidence contracts/testing.md#independent-expectations The expected units follow from the HTML comment grammar, in which both forms are complete comments, so the following heading must stay visible; the expected digest is that of the same prose without the comment, an independent document rather than a recomputation.
// @evidence contracts/testing.md#distinguishing-cases The two forms are the boundary where the closing marker overlaps the opening one; the following heading distinguishes an empty comment from an unclosed one that would hide it.
// @evidence contracts/testing.md#execution-ownership TestMarkdownScansDegenerateCommentsWithoutFailing is the selectable Go entry and calls scanMarkdownInventory through scanProjectMarkdown on authored strings in the native Go process, with no installed consumer, compiled host or filesystem.
func TestMarkdownScansDegenerateCommentsWithoutFailing(t *testing.T) {
  want := markdownUnitDigest(t, "## Pricing\n\nThe rate is capped.\n\n## Next\n", "docs/spec.md#pricing")
  for name, marker := range map[string]string{
    "empty comment":         "<!-->",
    "empty comment, dashed": "<!--->",
  } {
    t.Run(name, func(t *testing.T) {
      content := "## Pricing\n\nThe rate is capped. " + marker + "\n\n## Next\n"
      inventory, problems := scanProjectMarkdown("docs/spec.md", content)
      if len(problems) != 0 {
        t.Fatalf("unexpected scan problems: %v", problems)
      }
      if len(inventory.Declarations) != 0 || len(inventory.Reviews) != 0 {
        t.Fatal("an empty comment declared something")
      }
      next := false
      for _, unit := range inventory.Units {
        next = next || unit.Target == "docs/spec.md#next"
      }
      if !next {
        t.Fatal("the heading after an empty comment was hidden, so the comment was read as unclosed")
      }
      if got := markdownUnitDigest(t, content, "docs/spec.md#pricing"); got != want {
        t.Fatal("an empty comment is in the digest, so writing one would expire a review")
      }
    })
  }
}
