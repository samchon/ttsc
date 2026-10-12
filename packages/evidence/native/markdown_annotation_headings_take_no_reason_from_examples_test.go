package evidence

import (
  "strings"
  "testing"
)

/**
 * TestMarkdownAnnotationHeadingsTakeNoReasonFromExamples verifies a visible
 * annotation's reason is the prose a reader reads, and nothing else.
 *
 * Rendered Markdown hides metadata in comments and shows examples as code, so
 * neither may supply the reason an annotation requires. A fenced block whose
 * closing fence the parser leaves outside the code, an indented block, a
 * rendered `<pre>` block and a comment-only explanation are all no reason. A
 * prose line opening a tag inside a section is reported as unreadable and is
 * neither a declaration nor part of the explanation. Prose after an example,
 * including a line that opens with inline code, still explains.
 *
 *  1. Scan one document per explanation shape, with LF and with CRLF lines.
 *  2. Require the single declaration's line and reason and the unreadable
 *     reports.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown inventories documents whose H3 `@evidence` section holds a fenced, indented, `<pre>` or comment-only explanation, an example followed by prose, an inline-code-led prose line, or a prose `@evidence` line; each subtest runs with LF and CRLF lines and compares the declaration count, its line, the reason and the unreadable reports with literals.
 * @evidence contracts/testing.md#independent-expectations The contract requires a nonempty reason outside examples and comments and refuses prose tags in rendered Markdown, so each example-only reason must be empty, each prose reason exactly the written words, and the prose tag one unreadable report and no declaration.
 * @evidence contracts/testing.md#distinguishing-cases Four example carriers, one of which leaves its closing fence visible, against the prose-after-example and inline-code-led controls that must keep their text; the prose tag row distinguishes a reported line from the explanation around it, and the CRLF variants keep a carriage return from becoming prose.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationHeadingsTakeNoReasonFromExamples is a native Go unit entry; scanProjectMarkdown runs the Markdown scanner on in-memory content in the test process with no graph or product host.
 */
func TestMarkdownAnnotationHeadingsTakeNoReasonFromExamples(t *testing.T) {
  for _, scenario := range []struct {
    name        string
    explanation string
    reason      string
    unreadable  int
  }{
    {"fenced", "```text\nExample only.\n```\n", "", 0},
    {"tilde fenced", "~~~\n@evidence fake.md Example only.\n~~~\n", "", 0},
    {"indented", "    Example only.\n", "", 0},
    {"pre", "<pre>\nExample only.\n</pre>\n", "", 0},
    {"comment", "<!-- A note for authors. -->\n", "", 0},
    {"prose after example", "```text\nExample only.\n```\n\nThe real reason.\n", "The real reason.", 0},
    {"inline code first", "`clamp()` keeps the cap.\n", "`clamp()` keeps the cap.", 0},
    {"prose tag", "The real reason.\n\n@evidence docs/fake.md Written as prose.\n", "The real reason.", 1},
  } {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run(scenario.name+"/"+strings.ReplaceAll(strings.ReplaceAll(newline, "\r", "CR"), "\n", "LF"), func(t *testing.T) {
        content := strings.ReplaceAll("# Doc\n\n## Section {#section}\n\nBody.\n\n### @evidence docs/spec.md#rule\n\n"+scenario.explanation, "\n", newline)
        inventory, problems := scanProjectMarkdown("docs/plan.md", content)
        if len(problems) != 0 {
          t.Fatalf("unexpected scan problems: %v", problems)
        }
        if len(inventory.Declarations) != 1 || inventory.Declarations[0].Target != "docs/spec.md#rule" || inventory.Declarations[0].Line != 7 {
          t.Fatalf("expected the one visible citation at line 7, got %#v", inventory.Declarations)
        }
        if reason := inventory.Declarations[0].Reason; reason != scenario.reason {
          t.Fatalf("reason %q, want %q", reason, scenario.reason)
        }
        if len(inventory.Unreadable) != scenario.unreadable {
          t.Fatalf("unreadable reports %v, want %d", inventory.Unreadable, scenario.unreadable)
        }
        for _, report := range inventory.Unreadable {
          if !strings.Contains(report, "Unreadable @evidence at docs/plan.md:") || !strings.Contains(report, "this line is prose") {
            t.Fatalf("the prose tag lost its report: %q", report)
          }
        }
      })
    }
  }
}
