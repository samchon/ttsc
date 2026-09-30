package evidence

import (
  "testing"
)

/**
 * Verifies a reference that does not require a review demands nothing.
 *
 * Every reference policy in this plugin is opt-in and its false value is the
 * historical behavior, so the compatibility claim is that an existing project
 * sees no new diagnostic. A regression here is the worst kind of release: every
 * consumer's build breaks on tags they were never asked to write.
 *
 *  1. Use the same fixture with `requireReview` absent.
 *  2. Assert the graph is clean with no review tag anywhere.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates an unrevised citation with requireReview omitted and requires a clean graph.
 * @evidence contracts/testing.md#independent-expectations Review enforcement is opt-in, so existing references demand no review by default.
 * @evidence contracts/testing.md#distinguishing-cases The otherwise satisfied Pricing graph challenges unconditional review enforcement; explicit false is covered by RequireReviewDecodesLikeItsSiblings.
 * @evidence contracts/testing.md#execution-ownership TestReferenceWithoutRequireReviewDemandsNothing is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestReferenceWithoutRequireReviewDemandsNothing(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
