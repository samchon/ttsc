package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownLiteralDelimitersCannotHideProseTags verifies example delimiters
// cannot change the lexical owner of later real prose annotations.
//
// The former reporter opened rendered state before checking fenced or inline
// ownership. A literal pre opener then silenced the rest of the file. Comment
// ownership and rendered terminator kinds must also survive same-line chaining.
//
// 1. Put a literal opener in each inert position, followed by a real prose tag.
// 2. Require exactly the report at that tag's authored line, including CRLF.
// 3. Contrast prose after inline code with a tag inside code or after a wrong closer.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown and graphRule.Check through runProseTagRule; every literal opener leaves the following bare citation unreadable at its original line. Interior examples, prose prefixed by inline code and mismatched rendered terminators produce no invented report.
// @evidence contracts/testing.md#independent-expectations A literal delimiter has no state transition; a real prose tag is not an HTML-comment annotation. Literal source-line expectations and diagnostic counts follow from authored fixture layout, and the graph helper separately supplies a valid citation to isolate the unreadable report.
// @evidence contracts/testing.md#distinguishing-cases Covers fenced/inline/escaped/indented/comment/quoted-attribute delimiters, both HTML and MDX transitions, matching versus wrong closers, same-line close/open, CRLF and backtick-run boundaries. A real later citation remains covered independently of the unreadable tag.
// @evidence contracts/testing.md#execution-ownership This selectable Go unit entry owns its independent literal-delimiter variants. Scanner operations and the real graph rule execute in the native test process; helper-created Markdown fixture files require no installed consumer or native producer.
func TestMarkdownLiteralDelimitersCannotHideProseTags(t *testing.T) {
  examples := map[string]string{
    "fenced pre": "```html\n<pre>\n```\n",
    "fenced mdx": "```mdx\n<Code code={`\n```\n",
    "inline pre": "`<pre>`\n",
    "inline mdx": "``<Code code={` ``\n",
    "escaped pre": "\\<pre>\n",
    "escaped mdx": "\\={`\n",
    "indented pre": "    <pre>\n",
    "comment pre": "<!-- <pre> ={` -->\n",
    "comment then closed pre": "<!-- hidden --><pre>\nexample\n</pre>\n",
    "pre then comment then pre": "<pre></pre><!-- hidden --><pre>\nexample\n</pre>\n",
    "quoted opener": "<span title=\"<pre> ={`\">text</span>\n",
    "unmatched double run": "`` unmatched ` <pre> literal\n</pre>\n",
    "preview": "<preview>\n",
  }
  for name, example := range examples {
    t.Run(name, func(t *testing.T) {
      tag := "@evidence docs/spec/rules.md#pricing Actual prose.\n"
      expected := strings.Count(example, "\n") + 5
      assertReported(t, runProseTagRule(t, example+tag), "Unreadable @evidence at docs/claim/plan.md:"+decimal(expected))
      content := strings.ReplaceAll("# Public\n"+example+tag, "\n", "\r\n")
      inventory, _ := scanProjectMarkdown("docs/claim.md", content)
      if len(inventory.Unreadable) != 1 || !strings.Contains(inventory.Unreadable[0], "docs/claim.md:"+decimal(expected-3)+":") {
        t.Fatalf("literal delimiter hid or moved CRLF prose report: %v", inventory.Unreadable)
      }
    })
  }
  for name, content := range map[string]string{
    "inline tag": "`@evidence docs/spec/rules.md#pricing Example.`\n",
    "inline prefix": "`code` @evidence docs/spec/rules.md#pricing Mention.\n",
    "pre wrong mdx closer": "<pre>\n`}\n@evidence docs/spec/rules.md#pricing Example.\n</pre>\n",
    "mdx wrong html closer": "<Code code={`\n</pre>\n@evidence docs/spec/rules.md#pricing Example.\n`} />\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runProseTagRule(t, content))
    })
  }
}
