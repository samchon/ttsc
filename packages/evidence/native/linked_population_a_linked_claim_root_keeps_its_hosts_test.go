package evidence

import (
  "testing"
)

/**
 * Verifies a Markdown claim rooted at a link keeps its hosts.
 *
 * The claim side is the half that failed in silence. An empty healthy claim
 * deactivates without a word, so the obligation over every document behind the
 * link simply stopped existing, and no diagnostic anywhere said so.
 *
 *  1. Root a Markdown claim at the link, selecting documents that host nothing.
 *  2. Run the rule.
 *  3. Assert the claim is active by reading the acknowledgement it now owes.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports an uncovered Refunds reference when its Markdown claim root is linked.
 * @evidence contracts/testing.md#independent-expectations The literal docs/policy.md#refunds diagnostic demonstrates the claim is active.
 * @evidence contracts/testing.md#distinguishing-cases A linked claim population contrasts with an inactive claim that would suppress reference coverage.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedClaimRootKeepsItsHosts(t *testing.T) {
  workspace := t.TempDir()
  writeLinkedDocuments(t, workspace, map[string]string{
    "requirements/pricing.md": "## Discounts {#discounts}\n",
  })
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/policy.md": "### Refunds {#refunds}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../documents",
    "files":["requirements/**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h3"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/policy.md#refunds'")
}
