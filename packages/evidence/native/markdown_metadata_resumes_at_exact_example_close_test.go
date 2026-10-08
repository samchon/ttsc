package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownMetadataResumesAtExactExampleClose verifies a genuine citation
// and review after code on the same line retain their source position, host and
// metadata fingerprint boundary.
//
// Whole-line suppression would hide the real annotation, while a raw substring
// scan would also read the comment example. The original bytes before and beside
// the metadata must stay content even when Unicode or CRLF changes their layout.
//
// 1. Place real citation/review comments immediately after each closed example.
// 2. Require their literal line, target and visible heading host.
// 3. Edit annotation prose, example text and adjacent public prose separately.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on same-line HTML/MDX closes, inline code and quoted attribute examples followed by genuine citation/review comments. Asserts exact counts, targets, line-three positions and host ownership, then requires metadata edits to preserve the digest while example and adjacent prose edits change it.
// @evidence contracts/testing.md#independent-expectations Literal comments after the matching example close are real metadata on the public heading; their text is excluded while rendered example and public prose remain content. The authored third line and relational digest expectations come from this contract without asserting implementation-generated hash bytes.
// @evidence contracts/testing.md#distinguishing-cases Covers HTML and MDX grammars, Unicode before a case-insensitive HTML close, quoted MDX tail attributes, repeated MDX template attributes, inline runs and a quoted HTML comment example. LF and CRLF inputs contrast metadata-only edits with two independent content edits.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit entry owns its table and mutation subtests and calls only the native scanner on strings in the current process; no filesystem, installed artifact, native producer or product host is needed.
func TestMarkdownMetadataResumesAtExactExampleClose(t *testing.T) {
  real := "<!-- @evidence docs/spec.md#rule Actual. --> <!-- @evidenceReview docs/spec.md#rule Verified. --> public body\n"
  for name, example := range map[string]string{
    "pre": "<pre>Example.</pre>",
    "unicode pre": "<pre>\u212a Example.</PRE>",
    "mdx": "<Code code={`Example.`} />",
    "mdx tail attributes": "<Code code={`Example.`} title=\"<pre> <!--\" />",
    "mdx repeated attributes": "<Code first={`Example.`} second={`literal <!-- -->`} />",
    "inline": "`<!-- @evidence docs/spec.md#rule Example. -->` ",
    "quoted html": "<span title=\"<!-- @evidence docs/spec.md#rule Example. -->\">text</span>",
  } {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run(name+"/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
        content := strings.ReplaceAll("# Public\n\n"+example+real, "\n", newline)
        inventory, problems := scanProjectMarkdown("docs/spec.md", content)
        if len(problems) != 0 || len(inventory.Unreadable) != 0 || len(inventory.Units) != 2 ||
          len(inventory.Declarations) != 1 || len(inventory.Reviews) != 1 {
          t.Fatalf("real metadata after code was lost or duplicated: problems=%v unreadable=%v declarations=%v reviews=%v units=%v", problems, inventory.Unreadable, inventory.Declarations, inventory.Reviews, inventory.Units)
        }
        declaration, review := inventory.Declarations[0], inventory.Reviews[0]
        if declaration.Target != "docs/spec.md#rule" || declaration.Line != 3 || review.Target != "docs/spec.md#rule" ||
          review.Line != 3 || declaration.HostID != inventory.Units[1].ID || len(review.SemanticHostIDs) != 1 ||
          review.SemanticHostIDs[0] != inventory.Units[1].ID {
          t.Fatalf("metadata lost exact target, line or public host: declaration=%+v review=%+v", declaration, review)
        }
        for _, change := range []struct {
          before string
          after string
          content bool
        }{
          {"Actual.", "Rechecked.", false},
          {"Verified.", "Verified again.", false},
          {"Example.", "Changed example.", true},
          {"public body", "changed public body", true},
        } {
          changed, _ := scanProjectMarkdown("docs/spec.md", strings.Replace(content, change.before, change.after, 1))
          moved := inventory.Units[1].Digest != changed.Units[1].Digest
          if inventory.Units[1].Digest == "" || moved != change.content {
            t.Errorf("editing %q moved digest=%v, want %v", change.before, moved, change.content)
          }
        }
      })
    }
  }
}
