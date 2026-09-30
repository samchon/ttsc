package evidence

import "testing"

/**
 * Verifies a Markdown claim is told why it cannot use an inline link.
 *
 * A braced target in Markdown would otherwise fall through to a resolver that
 * has nothing to resolve against, and the author needs to hear the reason
 * rather than a generic failure.
 *
 * The reference here is Markdown rather than TypeScript, and deliberately so:
 * a TypeScript reference is now refused to this claim at configuration decode,
 * and that rejection happens to carry the same sentence. The case would have
 * kept passing while testing nothing — so the fixture cites a document, where
 * the braced form is still the author's mistake to hear about.
 *
 *  1. Cite a Markdown section from a Markdown claim, braced.
 *  2. Evaluate the graph.
 *  3. Assert the explanatory rejection names the inline link itself.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a Markdown claim is told why it cannot use an inline link. The original assertions check assert the explanatory rejection names the inline link itself.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A braced target in Markdown would otherwise fall through to a resolver that has nothing to resolve against, and the author needs to hear the reason rather than a generic failure. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from a Markdown claim, braced. Evaluate the graph. Assert the explanatory rejection names the inline link itself. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphRejectsInlineLinksInMarkdownClaims is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphRejectsInlineLinksInMarkdownClaims(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":   "## Pricing {#pricing}\n",
    "docs/reader.md": "<!-- @evidence {@link pricing} Documents this section. -->\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/reader.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Inline link target '{@link pricing}'")
  assertProblemContains(t, messages, "a markdown comment has none")
}
