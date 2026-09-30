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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a block holding only a tag counts as content. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The rule checks presence, never prose quality. A citation with no prose around it is a complete JSDoc block for this rule's purpose, and reporting it would push authors to pad blocks to satisfy a linter. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document an export with nothing but an `@evidence` tag. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsTagOnlyBlocks is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsTagOnlyBlocks(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
/** @evidence docs/spec.md#parse Implements the documented normalization. */
export function parse(value: string): string {
  return value;
}
`, ""))
}
