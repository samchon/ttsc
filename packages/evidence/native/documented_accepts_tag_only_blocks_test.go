package evidence

import "testing"

/**
 * Verifies a block holding only a tag counts as content.
 *
 * The rule checks presence, never prose quality. A citation with no prose
 * around it is a complete JSDoc block for this rule's purpose, and reporting it
 * would push authors to pad blocks to satisfy a linter.
 *
 *  1. Document an export with nothing but an `@evidence` tag.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export function parse` whose only documentation is a block containing a single `@evidence docs/spec.md#parse ...` tag; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: a block with a tag but no surrounding prose still has content, because the rule checks presence rather than prose quality.
 * @evidence contracts/testing.md#distinguishing-cases A tag-only block against the empty and asterisk-only blocks that the sibling report entries must report; the cited target is never resolved here, so only the documented rule is exercised.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsTagOnlyBlocks is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsTagOnlyBlocks(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** @evidence docs/spec.md#parse Implements the documented normalization. */
export function parse(value: string): string {
  return value;
}
`, ""))
}
