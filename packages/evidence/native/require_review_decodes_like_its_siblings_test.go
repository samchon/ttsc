package evidence

import (
  "testing"
)

/**
 * Verifies the flag decodes with the same strictness as its three siblings.
 *
 * A JSON `null` decodes into Go's false without complaint, which would make a
 * broken generator's output indistinguishable from an option nobody wrote. Only
 * the two literals are the contract, and an explicit `false` must behave exactly
 * as an omitted key so the historical behavior is reachable by writing it down.
 *
 *  1. Declare `requireReview: null` and assert it is rejected.
 *  2. Declare `requireReview: false` on an otherwise satisfied graph and assert
 *     nothing is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates the same satisfied TypeScript-to-Markdown graph with null and false review flags; null must diagnose requireReview, false must stay clean.
 * @evidence contracts/testing.md#independent-expectations The configuration contract admits boolean literals only; explicit false preserves opt-in behavior.
 * @evidence contracts/testing.md#distinguishing-cases Null versus false separates malformed input from a deliberate disabled policy; other invalid JSON types are not exercised here.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewDecodesLikeItsSiblings is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewDecodesLikeItsSiblings(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`,
  }
  assertProblemContains(t, runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "requireReview":null
    }
  }]}`), "requireReview")
  assertNoProblems(t, runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "requireReview":false
    }
  }]}`))
}
