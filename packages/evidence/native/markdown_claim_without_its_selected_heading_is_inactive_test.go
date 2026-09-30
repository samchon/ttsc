package evidence

import "testing"

/**
 * Verifies a matched Markdown file without the selected heading is inactive.
 *
 * File matching alone does not create a claim host. An H1-only document under
 * an H2 claim has no selected own unit, so the unreadable reference behind it
 * must not be loaded or diagnosed.
 *
 *  1. Match one Markdown file containing an H1 but no H2.
 *  2. Select H2 claim hosts and configure an unreadable Prisma reference.
 *  3. Assert the healthy zero-selected claim remains silent.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a matched Markdown file without the selected heading is inactive. The original assertions check assert the healthy zero-selected claim remains silent.
 * @evidence contracts/testing.md#independent-expectations File matching alone does not create a claim host. An H1-only document under an H2 claim has no selected own unit, so the unreadable reference behind it must not be loaded or diagnosed. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Match one Markdown file containing an H1 but no H2. Select H2 claim hosts and configure an unreadable Prisma reference. Assert the healthy zero-selected claim remains silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownClaimWithoutItsSelectedHeadingIsInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownClaimWithoutItsSelectedHeadingIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/README.md": "# Overview\n",
    "src/index.ts":   "export interface Index {}\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/**/*.md"],
    "symbol":"h2",
    "reference":{
      "type":"prisma",
      "root":"missing-prisma",
      "files":["**/*.prisma"],
      "symbol":"model"
    }
  }]}`))
}
