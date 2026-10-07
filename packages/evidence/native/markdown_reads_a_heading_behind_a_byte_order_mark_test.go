package evidence

import "testing"

// TestMarkdownReadsAHeadingBehindAByteOrderMark verifies a document that opens
// with a UTF-8 byte order mark still materializes its first heading.
//
// Windows editors write the mark, and a Markdown renderer ignores it. A scan that
// kept it in front of the opening `#` would not see the heading, and its unit,
// and every obligation resting on it, would disappear without a diagnostic.
//
// 1. Scan a document whose first line is a heading preceded by the mark.
// 2. Require the heading's unit and an identical unit for the same document without the mark.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on a document beginning with the mark and lists the unit targets it returns; the heading unit must be present.
// @evidence contracts/testing.md#independent-expectations The expected targets are the literal file and heading addresses a renderer shows for this document, written by hand rather than taken from the scan of the markless copy alone.
// @evidence contracts/testing.md#distinguishing-cases The markless copy is the adjacent input that already worked and must stay identical; the marked copy is the case that lost its first heading.
// @evidence contracts/testing.md#execution-ownership TestMarkdownReadsAHeadingBehindAByteOrderMark is the selectable Go entry and calls scanMarkdownInventory through scanProjectMarkdown on authored strings in the native Go process, with no installed consumer, compiled host or filesystem.
func TestMarkdownReadsAHeadingBehindAByteOrderMark(t *testing.T) {
  targetsOf := func(content string) []string {
    inventory, problems := scanProjectMarkdown("docs/spec.md", content)
    if len(problems) != 0 {
      t.Fatalf("unexpected scan problems: %v", problems)
    }
    targets := []string{}
    for _, unit := range inventory.Units {
      targets = append(targets, unit.Target)
    }
    return targets
  }
  want := []string{"docs/spec.md", "docs/spec.md#pricing"}
  for name, content := range map[string]string{
    "without the mark": "## Pricing\n\nThe rate is capped.\n",
    "with the mark":    "\xef\xbb\xbf## Pricing\n\nThe rate is capped.\n",
  } {
    t.Run(name, func(t *testing.T) {
      got := targetsOf(content)
      if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
        t.Fatalf("units = %v, want %v", got, want)
      }
    })
  }
}
