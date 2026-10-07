package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownReadsNoTagFromCode verifies a comment marker written inside fenced
// or inline code is an example: it declares nothing and stays in the digest.
//
// The digest cuts exactly the spans the declaration scan reads as tags, so code
// wrongly read as a comment would both invent a citation and drop the example
// from its section's digest, leaving an edit to the example unnoticed. The last
// two rows are the negative twins, where a comment follows code on the same line
// and is a real tag.
//
// 1. Scan a section whose example sits in a fence or a code span and require no declaration.
// 2. Change only the example text and require the section digest to move.
// 3. Scan a real comment after code and after an unmatched backtick, require one declaration, and require the digest to ignore its text.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on each authored section and reads the declarations and the unit digest it returns; a comment marker inside a backtick fence, a tilde fence holding a shorter run, a CRLF fence and a one or two backtick code span yields no declaration and a digest that follows the example, while a comment after a code span or an unmatched backtick yields one declaration and a digest that does not.
// @evidence contracts/testing.md#independent-expectations The expectations follow from the Markdown rule that code shows its text literally and from the digest contract that a tag position is excluded; they are a literal declaration count, the literal target docs/spec.md#x and digest equality or inequality, none computed from the scanner.
// @evidence contracts/testing.md#distinguishing-cases Five code spellings are the negatives where nothing may be read or cut; two real comments beside code are the positives where exactly one tag must be read and its text left out of the digest, so reading every marker or none both fail.
// @evidence contracts/testing.md#execution-ownership TestMarkdownReadsNoTagFromCode is the selectable Go entry and calls scanMarkdownInventory through scanProjectMarkdown on authored strings in the native Go process, with no installed consumer, compiled host or filesystem.
func TestMarkdownReadsNoTagFromCode(t *testing.T) {
  scan := func(content string) (*artifactInventory, string) {
    inventory, _ := scanProjectMarkdown("docs/spec.md", content)
    digest := ""
    for _, unit := range inventory.Units {
      if unit.Target == "docs/spec.md#pricing" {
        digest = unit.Digest
      }
    }
    return inventory, digest
  }
  examples := map[string]string{
    "backtick fence":                    "## Pricing\n\n```md\n<!-- @evidence docs/spec.md#x Example. -->\n```\n",
    "tilde fence holding a shorter run": "## Pricing\n\n~~~~\n~~~\n<!-- @evidence docs/spec.md#x Example. -->\n~~~~\n",
    "crlf fence":                        "## Pricing\r\n\r\n```md\r\n<!-- @evidence docs/spec.md#x Example. -->\r\n```\r\n",
    "inline code span":                  "## Pricing\n\nWrite `<!-- @evidence docs/spec.md#x Example. -->` to cite.\n",
    "double backtick code span":         "## Pricing\n\nWrite ``<!-- @evidence docs/spec.md#x Example. -->`` to cite.\n",
  }
  for name, content := range examples {
    t.Run(name, func(t *testing.T) {
      inventory, digest := scan(content)
      if len(inventory.Declarations) != 0 {
        t.Fatalf("a comment marker inside code was read as %d declaration(s)", len(inventory.Declarations))
      }
      _, changed := scan(strings.Replace(content, "Example.", "Changed.", 1))
      if digest == "" || digest == changed {
        t.Fatal("the example inside code is missing from the digest, so editing it expires nothing")
      }
    })
  }
  reals := map[string]string{
    "after a code span":           "## Pricing\n\nUse `code` <!-- @evidence docs/spec.md#x Example. -->\n",
    "after an unmatched backtick": "## Pricing\n\nIt's 5` of cap <!-- @evidence docs/spec.md#x Example. -->\n",
  }
  for name, content := range reals {
    t.Run(name, func(t *testing.T) {
      inventory, digest := scan(content)
      if len(inventory.Declarations) != 1 || inventory.Declarations[0].Target != "docs/spec.md#x" {
        t.Fatalf("a real comment beside code must declare exactly docs/spec.md#x, got %d declaration(s)", len(inventory.Declarations))
      }
      _, changed := scan(strings.Replace(content, "Example.", "Changed.", 1))
      if digest == "" || digest != changed {
        t.Fatal("the text of a real comment is in the digest, so writing a tag there would expire the review it is checked against")
      }
    })
  }
}
