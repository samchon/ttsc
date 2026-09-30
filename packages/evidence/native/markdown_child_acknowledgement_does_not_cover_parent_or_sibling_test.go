package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies hierarchy direction: acknowledging a child cannot cover its parent
 * or a sibling subtree.
 *
 * Scope inheritance is downward only. A reverse match would let a narrow
 * implementation claim a broader contract it never named.
 *
 *  1. Cite one H3 child in a document containing two H2 subtrees.
 *  2. Leave its H2 parent and the sibling subtree uncited.
 *  3. Assert all three broader or unrelated units remain missing.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites Validate and requires three missing findings for Create, Cancel, and Refund.
 * @evidence contracts/testing.md#independent-expectations Scope inheritance runs downward: a child cannot cover its parent or a sibling subtree.
 * @evidence contracts/testing.md#distinguishing-cases The child-only citation with named parent/sibling obligations detects reverse and global cascades.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownChildAcknowledgementDoesNotCoverParentOrSibling is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestMarkdownChildAcknowledgementDoesNotCoverParentOrSibling(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Create
### Validate
## Cancel
### Refund
`,
    "src/ref.ts": `
/** @evidence docs/spec.md#validate This implementation performs validation. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
  }]}`)
  if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 3 {
    t.Fatalf("H3 citation produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'docs/spec.md#create'")
  assertProblemContains(t, messages, "'docs/spec.md#cancel'")
  assertProblemContains(t, messages, "'docs/spec.md#refund'")
}
