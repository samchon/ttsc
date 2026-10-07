package evidence

import (
  "strings"
  "testing"
)

// TestMarkdownExamplesShareAnnotationAndContentBoundaries verifies every
// supported example spelling is inert to annotations, units and prose reports,
// while its original bytes remain fingerprint content.
//
// The regression is one lexical disagreement: a comment-looking example could
// satisfy coverage and vanish from a digest while the prose reporter ignored it.
// The same cases now distinguish all four readers and a real following comment.
//
// 1. Scan each example and require only the visible file and public heading.
// 2. Edit example text and require the public section fingerprint to change.
// 3. Append a real citation and require its original source line and host.
//
// @evidence contracts/testing.md#behavioral-verification Calls scanProjectMarkdown for fenced, indented, inline, escaped, HTML and MDX examples; asserts exact units, no declarations/reviews/unreadable tags, changed content digests and a real subsequent citation's target, line and heading host.
// @evidence contracts/testing.md#independent-expectations Code examples display literal markers, so they supply no annotation or heading; their visible text remains content. Expected file/public targets and the appended citation's line come from the authored document layout, not scanner-computed classification or digest bytes.
// @evidence contracts/testing.md#distinguishing-cases Backtick/tilde fences, short internal fences, four spaces/tabs, odd escapes, single/double inline runs, pre/MDX close-open transitions, quoted and multiline attributes, CRLF and Unicode are negatives; the appended real comment is the positive recovery boundary for every row.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit entry calls the native scanner directly on authored strings in the test process. It owns its table subtests without consumer installs, native producer builds or product subprocesses.
func TestMarkdownExamplesShareAnnotationAndContentBoundaries(t *testing.T) {
  annotation := "<!-- @evidence docs/spec.md#rule Example. -->"
  block := "# Hidden\n" + annotation + "\n<!-- @evidenceExclude docs/spec.md#rule Example. -->\n" +
    "<!-- @evidenceReview docs/spec.md#rule Example. -->\n" +
    "<!-- @evidenceExcludeReview docs/spec.md#rule Example. -->\n" +
    "@evidence docs/spec.md#rule Example.\n"
  cases := map[string]string{
    "backtick fence": "```md\n" + block + "```\n",
    "tilde fence with shorter run": "~~~~\n~~~\n" + block + "~~~~\n",
    "four spaces": "    " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n    ") + "\n",
    "tab": "\t" + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n\t") + "\n",
    "inline": "`" + annotation + "`\n",
    "double inline with interior backtick": "`` ` " + annotation + " ``\n",
    "escaped comment": "\\" + annotation + "\n",
    "escaped pre": "\\<pre>\n\\" + annotation + "\n",
    "quoted fence": "> ```md\n> " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n> ") + "\n> ```\n",
    "list fence": "1. ```md\n   " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n   ") + "\n   ```\n",
    "quoted list fence": "> - ```md\n>   " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n>   ") + "\n>   ```\n",
    "quoted indent": ">     " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n>     ") + "\n",
    "list indent": "- item\n\n      " + strings.ReplaceAll(strings.TrimSuffix(block, "\n"), "\n", "\n      ") + "\n",
    "multiline inline": "``first\nx " + annotation + "\n@evidence docs/spec.md#rule Example.\nlast``\n",
    "mdx interior fence": "<Code code={`\n```md\n" + block + "```\n`} />\n",
    "raw pre": "<pre>\n" + block + "</pre>\n",
    "pre case and quoted delimiters": "<PRE title=\"</pre> <!--\">\n" + block + "</PRE>\n",
    "pre multiline quoted attribute": "<pre title=\"\n</pre>\n\">\n" + block + "</pre>\n",
    "pre same line": "<pre>" + annotation + "</pre>\n",
    "pre close then open": "<pre>Example.</pre><pre>\n" + block + "</pre>\n",
    "unicode before pre close then open": "<pre>\u212a Example.</PRE><pre>\n" + block + "</pre>\n",
    "mdx": "<Code code={`\n" + block + "`} />\n",
    "mdx close then open": "<Code code={`Example.`} /><Code code={`\n" + block + "`} />\n",
    "pre close then mdx open": "<pre>Example.</pre><Code code={`\n" + block + "`} />\n",
    "mdx close then pre open": "<Code code={`Example.`} /><pre>\n" + block + "</pre>\n",
    "mdx escaped close": "<Code code={`\\`}\n" + block + "`} />\n",
    "quoted attribute": "<aside title=\"" + annotation + " <pre> ={`\">text</aside>\n",
    "multiline quoted attribute": "<aside title=\"\n" + block + "\">text</aside>\n",
    "unclosed pre": "<pre>\n" + block,
    "unclosed mdx": "<Code code={`\n" + block,
  }
  for name, example := range cases {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run(name+"/"+strings.ReplaceAll(newline, "\n", "LF"), func(t *testing.T) {
        content := "# Public\n\u03c0 body\n\n" + example
        content = strings.ReplaceAll(content, "\n", newline)
        inventory, problems := scanProjectMarkdown("docs/spec.md", content)
        if len(problems) != 0 || len(inventory.Unreadable) != 0 ||
          len(inventory.Declarations) != 0 || len(inventory.Reviews) != 0 {
          t.Fatalf("example supplied metadata or diagnostics: problems=%v unreadable=%v declarations=%v reviews=%v", problems, inventory.Unreadable, inventory.Declarations, inventory.Reviews)
        }
        if len(inventory.Units) != 2 || inventory.Units[0].Target != "docs/spec.md" || inventory.Units[1].Target != "docs/spec.md#public" {
          t.Fatalf("example materialized an extra unit: %v", inventory.Units)
        }
        edited, _ := scanProjectMarkdown("docs/spec.md", strings.Replace(content, "Example.", "Changed.", 1))
        if inventory.Units[1].Digest == "" || inventory.Units[1].Digest == edited.Units[1].Digest {
          t.Fatal("example edit did not change its visible section's content fingerprint")
        }
        if strings.HasPrefix(name, "unclosed ") {
          return // An unclosed example still owns its suffix.
        }
        after := content + "<!-- @evidence docs/spec.md#rule Actual. -->" + newline
        restored, _ := scanProjectMarkdown("docs/spec.md", after)
        expectedLine := strings.Count(content, "\n") + 1
        if len(restored.Declarations) != 1 || restored.Declarations[0].Target != "docs/spec.md#rule" ||
          restored.Declarations[0].Line != expectedLine || restored.Declarations[0].HostID != inventory.Units[1].ID {
          t.Fatalf("following real comment lost its source position or host: expected line %d, got %v", expectedLine, restored.Declarations)
        }
      })
    }
  }
}
