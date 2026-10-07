package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a linked base and the base it resolves onto stay two obligations.
 *
 * The negative twin of the TypeScript repair, and the risk it carries: accepting
 * a second spelling makes one source belong to two bases where it belonged to one.
 * That is what a declared root already means, and each base owns its own address
 * space, so the two claims have to report separately and neither may report the
 * other's unit. A repair that collapsed them would double one obligation and
 * silence the other.
 *
 *  1. Link a directory onto the project and root one claim at the link, leaving
 *     a second claim on the default base.
 *  2. Give each a reference over a different document.
 *  3. Assert exactly one acknowledgement per claim, each naming its own.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports two independently attributed references for linked and default bases reaching one TypeScript source.
 * @evidence contracts/testing.md#independent-expectations Literal Discounts and Refunds targets, exactly two messages and one per claim define independent obligations.
 * @evidence contracts/testing.md#distinguishing-cases Physical identity is shared while authored claim bases and reference obligations remain distinct.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedBaseAndTheBaseItResolvesOntoStayTwoObligations(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(t, project, filepath.Join(workspace, "mirror")); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/docs/policy.md":  "## Refunds {#refunds}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[
    {
      "type":"typescript",
      "root":"../mirror",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/pricing.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/policy.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 2 {
    t.Fatalf("two claims owe one acknowledgement each, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/pricing.md#discounts'")
  assertProblemContains(t, messages, "'docs/policy.md#refunds'")
  if countProblemsContaining(messages, "Claim 1 reference 1") != 1 {
    t.Fatalf("the linked claim reports once:\n%s", strings.Join(messages, "\n"))
  }
  if countProblemsContaining(messages, "Claim 2 reference 1") != 1 {
    t.Fatalf("the default claim reports once:\n%s", strings.Join(messages, "\n"))
  }
}
