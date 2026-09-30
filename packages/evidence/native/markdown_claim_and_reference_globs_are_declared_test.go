package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies both Markdown sides of a graph are declared as glob populations.
 *
 * A Markdown claim and a Markdown reference are read from disk by the same
 * walk, so both are dependencies; but only the reference side is obvious, and
 * a declaration that covered references alone would leave a claim file's
 * `<!-- @evidence -->` comment editable without any host noticing.
 *
 *  1. Configure a Markdown claim citing a Markdown reference.
 *  2. Publish the rule's project inputs.
 *  3. Assert both glob sets appear, and that nothing was declared as a file.
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require both glob sets appear, and that nothing was declared as a file.
 * @evidence contracts/testing.md#independent-expectations A Markdown claim and a Markdown reference are read from disk by the same walk, so both are dependencies; but only the reference side is obvious, and a declaration that covered references alone would leave a claim file's `<!-- @evidence -->` comment editable without any host noticing.
 * @evidence contracts/testing.md#distinguishing-cases Configure a Markdown claim citing a Markdown reference. Publish the rule's project inputs. Assert both glob sets appear, and that nothing was declared as a file.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownClaimAndReferenceGlobsAreDeclared is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestMarkdownClaimAndReferenceGlobsAreDeclared(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"markdown",
    "files":["docs/ledger/**/*.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/spec/**/*.md"],"symbol":"h2"}
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{
    "docs/ledger/**/*.md",
    "docs/spec/**/*.md",
  })
  assertDeclares(t, inputs, rule.ProjectInputFile, nil)
}
