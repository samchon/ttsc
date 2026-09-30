package evidence

import (
  "testing"
)

/**
 * Verifies fenced content counts toward its section's digest.
 *
 * The walk handles fenced lines in their own branches and returns early from each,
 * so a value maintained only on the ordinary path never reaches them. Fenced
 * content hosts no tag, so it is never excluded as a tag position; dropping it
 * would mean rewriting the example inside a cited section expires nothing, which
 * is the exact silence the fingerprint exists to break.
 *
 *  1. Digest a section containing a fenced code block.
 *  2. Change only a line inside the fence.
 *  3. Assert the section's digest moved.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification scanProjectMarkdown through markdownUnitDigest exercises this case. Verifies fenced content counts toward its section's digest.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Changing cap from 30 to 45 inside the fence must change pricing content identity. Equality would conceal a real code-example edit; no particular digest bytes are prescribed.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Digest a section containing a fenced code block. Change only a line inside the fence. Assert the section's digest moved.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownCountsFencedContent is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown through markdownUnitDigest in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownCountsFencedContent(t *testing.T) {
  before := "## Pricing {#pricing}\n\n```ts\nconst cap = 30;\n```\n"
  after := "## Pricing {#pricing}\n\n```ts\nconst cap = 45;\n```\n"
  if markdownUnitDigest(t, before, "docs/spec.md#pricing") ==
    markdownUnitDigest(t, after, "docs/spec.md#pricing") {
    t.Fatal("fenced content is missing from the digest, so a change inside a code block expires nothing")
  }
}
