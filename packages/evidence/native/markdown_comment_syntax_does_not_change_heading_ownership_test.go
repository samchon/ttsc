package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownCommentSyntaxDoesNotChangeHeadingOwnership verifies closed HTML
// comments cannot create section hosts or alter fenced-code recognition.
//
// Comments can open after ordinary prose and contain heading or fence syntax.
// That hidden syntax must not steal the following public text's digest owner.
//
// 1. Scan inline and line-leading comments containing heading and fence lines.
// 2. Compare the complete inventory with independently authored visible targets.
// 3. Change public prose and require its visible heading's digest to change.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown on closed comments containing Markdown syntax and verifies exact visible targets plus public-prose digest ownership, detecting invented hidden headings and a fence opened inside a comment.
// @evidence contracts/testing.md#independent-expectations Closed HTML comment contents are hidden metadata; literal visible heading targets and one public-prose edit establish the inventory and digest expectations without calculating the scanner's hash.
// @evidence contracts/testing.md#distinguishing-cases Inline comment opening hides a nested heading; a line-leading comment containing a fence must not suppress the next public heading. A genuine fenced example remains content and must not materialize its embedded heading.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit entry owns its independent comment and fence variants and calls the native scanner directly on authored strings, without filesystem preparation, native builds, installed consumers or product subprocesses.
func TestMarkdownCommentSyntaxDoesNotChangeHeadingOwnership(t *testing.T) {
  cases := []struct {
    name    string
    content string
  }{
    {"inline comment", "# Public\nprose <!--\n## Hidden\n-->\npublic body\n"},
    {"fence inside comment", "<!--\n```\n-->\n# Public\npublic body\n"},
    {"comment marker inside real fence", "# Public\n```\n<!--\n## Hidden\n-->\n```\npublic body\n"},
    {"unclosed example before real comment", "# Public\n```\n<!--\n```\n<!--\n## Hidden\n-->\npublic body\n"},
    {"multiple inline comments", "# Public\nprose <!-- first --> more <!--\n## Hidden\n-->\npublic body\n"},
    {"comment inside heading", "# Public <!-- hidden title -->\npublic body\n"},
  }
  for _, row := range cases {
    t.Run(row.name, func(t *testing.T) {
      inventory, problems := scanProjectMarkdown("docs/spec.md", row.content)
      if len(problems) != 0 {
        t.Errorf("unexpected scan problems: %v", problems)
      }
      targets := []string{}
      for _, unit := range inventory.Units {
        targets = append(targets, unit.Target)
      }
      if got := strings.Join(targets, ","); got != "docs/spec.md,docs/spec.md#public" {
        t.Errorf("visible targets = %q, want file and public heading only", got)
      }
      public := ""
      for _, unit := range inventory.Units {
        if unit.Target == "docs/spec.md#public" {
          public = unit.Digest
        }
      }
      edited, _ := scanProjectMarkdown("docs/spec.md", strings.Replace(row.content, "public body", "revised body", 1))
      revised := ""
      for _, unit := range edited.Units {
        if unit.Target == "docs/spec.md#public" {
          revised = unit.Digest
        }
      }
      if public == "" || revised == "" || public == revised {
        t.Errorf("public prose edit must change its visible owner's nonempty digest: before=%q after=%q", public, revised)
      }
    })
  }
}
