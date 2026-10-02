package evidence

import "testing"

/**
 * Verifies a Markdown claim is told why it cannot use an inline link.
 *
 * A braced target in Markdown would otherwise fall through to a resolver that
 * has nothing to resolve against, and the author needs to hear the reason
 * rather than a generic failure.
 *
 * The reference here is Markdown, so the case isolates the inline-link
 * rejection, which depends on the artifact of the citing comment and not on the
 * reference, from any resolution of a code population. The fixture cites a
 * document, where the braced form is still the author's mistake to hear about.
 *
 *  1. Cite a Markdown section from a Markdown claim, braced.
 *  2. Evaluate the graph.
 *  3. Assert the explanatory rejection names the inline link itself.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a Markdown claim over docs/reader.md (symbol file), which cites `<!-- @evidence {@link pricing} ... -->`, against a Markdown reference over docs/spec.md; the diagnostics must contain `Inline link target '{@link pricing}'` and `a markdown comment has none`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the diagnostic contract: a braced target in a Markdown comment has no import scope to resolve against, so the author must be told why it cannot be used rather than given a generic failure.
 * @evidence contracts/testing.md#distinguishing-cases A Markdown reference is used on purpose, so the rejection is observed without any code population to resolve against; only containment of the two fragments is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsInlineLinksInMarkdownClaims is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
