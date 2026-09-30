package evidence

import "testing"

/**
 * Verifies multiline Markdown declarations report the tag's line rather than
 * the opening HTML comment's line.
 *
 * Declaration locations are part of the repair path. Trimming the comment body
 * before parsing erases its leading newline and points the diagnostic at
 * `<!--`, which is especially misleading when several declarations share one
 * comment.
 *
 *  1. Put a reasonless declaration one line after an HTML comment opens.
 *  2. Trigger the malformed-declaration diagnostic.
 *  3. Assert its location identifies the actual tag line.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies multiline Markdown declarations report the tag's line rather than the opening HTML comment's line. The original assertions check assert its location identifies the actual tag line.
 * @evidence contracts/testing.md#independent-expectations Declaration locations are part of the repair path. Trimming the comment body before parsing erases its leading newline and points the diagnostic at `<!--`, which is especially misleading when several declarations share one comment. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Put a reasonless declaration one line after an HTML comment opens. Trigger the malformed-declaration diagnostic. Assert its location identifies the actual tag line. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownDeclarationPreservesMultilineTagLocation is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownDeclarationPreservesMultilineTagLocation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "docs/ref.md": `# Claim
<!--
@evidence docs/spec.md#contract
-->
`,
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"h1",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration at docs/ref.md:3")
}
