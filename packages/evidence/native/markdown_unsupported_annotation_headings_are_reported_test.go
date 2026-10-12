package evidence

import (
  "strings"
  "testing"
)

/**
 * TestMarkdownUnsupportedAnnotationHeadingsAreReported verifies a tag-shaped
 * heading that carries no annotation is reported rather than discarded.
 *
 * Only an H2, H3 or H4 heading of the document itself opens an annotation. An
 * H1, H5 or H6, and a heading inside a blockquote or a list item, look the same
 * to an author and reach no host, so each must be reported with both carriers
 * named as the repair, including an H5 written inside a supported section,
 * which stays part of that section's explanation. A supported section and a
 * heading inside a fenced example are not reported.
 *
 *  1. Write each unsupported spelling, a supported section and a fenced one in
 *     a Markdown claim document.
 *  2. Require one report per unsupported line naming its line, the heading
 *     cause and the heading repair, and no report for the others.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over a claim document holding tagged H1, H5 and H6 headings, a tagged H2 inside a blockquote and inside a list item, a supported H3 citation section holding a tagged H5, and a tagged heading inside a fence; the case requires exactly six unreadable reports at the six unsupported lines, each naming the heading cause and the `## @evidence <target>` repair.
 * @evidence contracts/testing.md#independent-expectations The annotation contract admits only H2-H4 headings of the document and requires every unreadable tag to be reported, so the six line numbers and the two message clauses follow from the authored fixture rather than from scanner output.
 * @evidence contracts/testing.md#distinguishing-cases Depth one, five and six, container quote and list, a deeper tagged heading inside a supported section, the supported H3 control and the fenced control separate every reason a heading is or is not a carrier; prose tag lines are owned by the existing prose entries.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownUnsupportedAnnotationHeadingsAreReported is a native Go unit entry; runProseTagRule writes temporary fixtures and calls the graph rule in-process without an installed consumer or product host.
 */
func TestMarkdownUnsupportedAnnotationHeadingsAreReported(t *testing.T) {
  messages := runProseTagRule(t, strings.Join([]string{
    "# @evidence docs/spec/rules.md#pricing An H1 carries nothing.",
    "",
    "##### @evidence docs/spec/rules.md#pricing An H5 carries nothing.",
    "",
    "###### @evidence docs/spec/rules.md#pricing An H6 carries nothing.",
    "",
    "> ## @evidence docs/spec/rules.md#pricing A quoted heading carries nothing.",
    "",
    "- ## @evidence docs/spec/rules.md#pricing A listed heading carries nothing.",
    "",
    "## Notes {#notes}",
    "",
    "### @evidence docs/spec/rules.md#pricing",
    "",
    "The notes restate the cap.",
    "",
    "##### @evidence docs/spec/rules.md#pricing A deeper heading inside the section carries nothing.",
    "",
    "```md",
    "## @evidence docs/spec/rules.md#pricing An example carries nothing.",
    "```",
    "",
  }, "\n"))
  // runProseTagRule prefixes four lines: the plan heading, a blank line, the
  // real citation and a blank line.
  for _, line := range []int{5, 7, 9, 11, 13, 21} {
    assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:"+decimal(line)+": a Markdown declaration is read from an HTML comment or from an H2, H3 or H4 heading of the document itself")
  }
  reports := 0
  for _, message := range messages {
    if strings.Contains(message, "Unreadable ") {
      reports++
      if !strings.Contains(message, "Write it as a '## @evidence <target>' heading with <reason> below it") {
        t.Fatalf("the report must name the heading repair: %q", message)
      }
    }
  }
  if reports != 6 {
    t.Fatalf("expected six unreadable reports, got:\n%s", strings.Join(messages, "\n"))
  }
}
