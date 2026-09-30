package evidence

import (
  "testing"
)

/**
 * Verifies unselected intermediate scopes remain addressable: an H2 can cover
 * selected H3 descendants without joining the obligation denominator.
 *
 * Selector filtering must happen after structural ancestry is recorded.
 * Otherwise omitting H2 would sever the document outline and make its aggregate
 * target unresolved.
 *
 *  1. Select only H3 units below two H2 sections.
 *  2. Cite each unselected H2 ancestor.
 *  3. Assert both H3 obligations are acknowledged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects only H3s and cites both unselected H2 ancestors; the graph must be clean.
 * @evidence contracts/testing.md#independent-expectations Selectors define obligations without deleting structural ancestors, so Create and Cancel can cover Validate and Refund.
 * @evidence contracts/testing.md#distinguishing-cases Two parent scopes test intermediate ancestry across siblings; selected-unit materialization is not independently counted here.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownUnselectedHeadingCoversSelectedDescendants is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestMarkdownUnselectedHeadingCoversSelectedDescendants(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Create
### Validate
## Cancel
### Refund
`,
    "src/ref.ts": `
/**
 * @evidence docs/spec.md#create Creation includes its validation contract.
 * @evidence docs/spec.md#cancel Cancellation includes its refund contract.
 */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h3"}
  }]}`)
  assertNoProblems(t, messages)
}
