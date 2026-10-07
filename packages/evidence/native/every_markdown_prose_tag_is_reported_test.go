package evidence

import (
  "testing"
)

/**
 * Verifies every prose tag in one document is reported, and that a closed fence
 * releases the lines after it.
 *
 * One report per tag, because each is its own declaration and an author fixing
 * the first should not have to build again to learn about the second. The fence
 * row is the state machine's other direction: a reporter that treated every
 * line after an opening fence as fenced would satisfy the fence cases while
 * silencing the whole rest of the document.
 *
 *  1. Close a fence, then write two citations after it.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported at their own lines.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over docs/claim/plan.md, which holds a closed backtick fence followed by two prose `@evidence` lines; assertReportedAmong requires `Unreadable @evidence at docs/claim/plan.md:9` and `Unreadable @evidence at docs/claim/plan.md:11`.
 * @evidence contracts/testing.md#independent-expectations The expected lines 9 and 11 follow from the authored fixture layout (heading, blank, citation comment, blank, a three-line fence, blank, first tag, blank, second tag); each tag is its own declaration, so both must be reported.
 * @evidence contracts/testing.md#distinguishing-cases Two tags after a closed fence: a reporter that stopped after the first tag, or one that treated everything after an opening fence as fenced, would miss the second or both. Only containment is asserted.
 * @evidence contracts/testing.md#execution-ownership TestEveryMarkdownProseTagIsReported is a Go unit entry in the native test process; runProseTagRule writes the Markdown fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestEveryMarkdownProseTagIsReported(t *testing.T) {
  messages := runProseTagRule(t, "```md\n<!-- an example -->\n```\n\n"+
    "@evidence docs/spec/rules.md#pricing The first.\n\n"+
    "@evidence docs/spec/rules.md#pricing The second.\n")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:9")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:11")
}
