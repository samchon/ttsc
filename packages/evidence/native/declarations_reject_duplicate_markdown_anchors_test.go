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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies duplicate Markdown anchors remain distinct source units and make a declaration target ambiguous. The original assertions check assert resolution reports both sections as ambiguous.
 * @evidence contracts/testing.md#independent-expectations Generated or explicit anchors can repeat inside one document. Collapsing them by target would let one declaration silently acknowledge two different sections and make heading order decide which source prose the edge means. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Give two selected headings the same explicit anchor. Cite that path-and-anchor target once. Assert resolution reports both sections as ambiguous. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationsRejectDuplicateMarkdownAnchors is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
