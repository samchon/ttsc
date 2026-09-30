package evidence

import (
  "testing"
)

/**
 * Verifies Markdown file scopes: one file acknowledgement covers every
 * selected heading descendant even when the file kind is not selected.
 *
 * A reference selector defines the obligation denominator, not the only
 * addressable scopes. Requiring `"file"` in the selector would make aggregate
 * citation unavailable to the common H2/H3-only population.
 *
 *  1. Select only H2 and H3 units from one document.
 *  2. Cite the unselected file ancestor once.
 *  3. Assert every selected heading is acknowledged.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects H2/H3 descendants but cites only docs/spec.md; assertNoProblems requires full coverage.
 * @evidence contracts/testing.md#independent-expectations A file scope addresses its selected descendants even when file itself is not selected.
 * @evidence contracts/testing.md#distinguishing-cases Four descendants in two subtrees challenge ancestor addressability; this clean-only case does not separately assert denominator cardinality.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownFileAcknowledgementCoversSelectedDescendants is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestMarkdownFileAcknowledgementCoversSelectedDescendants(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `# Product
## Create
### Validate
## Cancel
### Refund
`,
    "src/ref.ts": `
/** @evidence docs/spec.md The complete implementation follows this specification. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  }]}`)
  assertNoProblems(t, messages)
}
