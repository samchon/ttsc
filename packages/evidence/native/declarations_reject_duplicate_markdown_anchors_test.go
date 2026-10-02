package evidence

import "testing"

/**
 * Verifies duplicate Markdown anchors remain distinct source units and make a
 * declaration target ambiguous.
 *
 * Generated or explicit anchors can repeat inside one document. Collapsing
 * them by target would let one declaration silently acknowledge two different
 * sections and make heading order decide which source prose the edge means.
 *
 *  1. Give two selected headings the same explicit anchor.
 *  2. Cite that path-and-anchor target once.
 *  3. Assert resolution reports both sections as ambiguous.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over docs/spec.md with two headings both given the explicit anchor `{#shared}` and a cited `docs/spec.md#shared` from an interface; the test requires `Ambiguous evidence target 'docs/spec.md#shared'` naming `Markdown H2 'First'` and `Markdown H2 'Second'`.
 * @evidence contracts/testing.md#independent-expectations The expected ambiguity and both heading names are authored from the fixture: a repeated anchor must stay two source units and make the target ambiguous rather than letting heading order choose a section.
 * @evidence contracts/testing.md#distinguishing-cases Two headings sharing one anchor against a single citation; a collapse by target would credit one section silently and produce no ambiguity. Unique anchors are the implicit control in other entries.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationsRejectDuplicateMarkdownAnchors is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestDeclarationsRejectDuplicateMarkdownAnchors(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## First {#shared}
## Second {#shared}
`,
    "src/ref.ts": `
/** @evidence docs/spec.md#shared This target cannot choose a section. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target 'docs/spec.md#shared'")
  assertProblemContains(t, messages, "Markdown H2 'First'")
  assertProblemContains(t, messages, "Markdown H2 'Second'")
}
