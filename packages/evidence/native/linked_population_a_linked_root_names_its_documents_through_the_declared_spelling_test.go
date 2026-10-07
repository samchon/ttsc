package evidence

import (
  "testing"
)

/**
 * Verifies a document behind a link is named through the root the author
 * declared.
 *
 * The negative twin of the case above, and the property that decides how the
 * link is followed rather than whether. Walking the target and reporting its own
 * path would name a directory that appears nowhere in the configuration and
 * would move every citation target with it, which is the coupling a declared
 * root exists to remove.
 *
 *  1. Leave the selected section uncited behind the same link.
 *  2. Read the missing-acknowledgement diagnostic.
 *  3. Assert the target and the location are spelled through the declared root.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports the missing Discounts acknowledgement through ../documents and never /target/.
 * @evidence contracts/testing.md#independent-expectations Literal Discounts identity and ../documents line one are independent authored address expectations.
 * @evidence contracts/testing.md#distinguishing-cases Missing evidence keeps the declared-root diagnostic spelling even though reading follows the link.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedRootNamesItsDocumentsThroughTheDeclaredSpelling(t *testing.T) {
  workspace := t.TempDir()
  writeLinkedDocuments(t, workspace, map[string]string{
    "requirements/pricing.md": "## Discounts {#discounts}\n",
  })
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../documents/requirements/pricing.md:1")
  if countProblemsContaining(messages, "/target/") != 0 {
    t.Fatalf(
      "a document behind a link is named through the root, not through the link's own target",
    )
  }
}
