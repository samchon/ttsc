package evidence

import "testing"

// TestAMarkdownTagIndentedLessThanCodeIsReported verifies the prose-tag report
// treats only four spaces or a tab as code, and only a real `<pre>` as a block.
//
// A nested list item is indented by two or three spaces and is prose, so a
// citation written there reaches no host and is owed the same report as one at
// the margin. A tab opens an indented code block. An element whose name merely
// begins with `pre` is not a `<pre>` block, and reading it as one would silence
// every tag after it.
//
// 1. Write a citation as a nested bullet at two spaces and require it reported at its line.
// 2. Write the same line behind a tab and require silence.
// 3. Write a citation after a `<preview>` line and require it reported.
//
// @evidence contracts/testing.md#behavioral-verification Runs graphRule.Check through runProseTagRule over a claim document holding each line and reads the diagnostics; the two-space bullet and the line after a preview element are each reported exactly once at their own line, and the tab-indented line produces none.
// @evidence contracts/testing.md#independent-expectations The expected positions are literal document lines, five and six, fixed by the fixture's own layout, and the silence for a tab follows from the Markdown rule that a tab-indented line is code; none is read back from the reporter.
// @evidence contracts/testing.md#distinguishing-cases The two-space bullet and the tab-indented line differ only in indentation, and the preview element and the existing pre-block cases differ only in the element name, so each decision boundary has a case on both sides.
// @evidence contracts/testing.md#execution-ownership TestAMarkdownTagIndentedLessThanCodeIsReported is the selectable Go entry and runs graphRule.Check in the native Go process over fixture files written to a temporary directory by runIndexRule, with only Markdown populations configured so no Prisma or Swagger process starts.
func TestAMarkdownTagIndentedLessThanCodeIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "  - @evidence docs/spec/rules.md#pricing Nested bullet.\n"),
    "Unreadable @evidence at docs/claim/plan.md:5",
  )
  assertNoProblems(
    t,
    runProseTagRule(t, "\t@evidence docs/spec/rules.md#pricing Tab-indented code.\n"),
  )
  assertReported(
    t,
    runProseTagRule(t, "<preview>\n@evidence docs/spec/rules.md#pricing Not inside a pre block.\n"),
    "Unreadable @evidence at docs/claim/plan.md:6",
  )
}
