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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies every prose tag in one document is reported, and that a closed fence releases the lines after it.
 *
 * @evidence contracts/testing.md#independent-expectations After a closed fence, both authored prose citations must appear at their literal lines 9 and 11; the assertion does not merely accept the first report.
 *
 * @evidence contracts/testing.md#distinguishing-cases Close a fence, then write two citations after it. Evaluate the same claim. Assert both are reported at their own lines.
 *
 * @evidence contracts/testing.md#execution-ownership TestEveryMarkdownProseTagIsReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestEveryMarkdownProseTagIsReported(t *testing.T) {
  messages := runProseTagRule(t, "```md\n<!-- an example -->\n```\n\n"+
    "@evidence docs/spec/rules.md#pricing The first.\n\n"+
    "@evidence docs/spec/rules.md#pricing The second.\n")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:9")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:11")
}
