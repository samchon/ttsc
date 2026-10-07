package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies an exclusion glob is dropped rather than published.
 *
 * The host's dependency model has no negation, so a declared `!docs/private/**`
 * would be read as a population to watch; the exact inverse of what the author
 * wrote. The positive twin in the same case is what proves the filter discards
 * only the exclusion instead of discarding the set.
 *
 *  1. Configure a Markdown reference with one positive and one negative glob.
 *  2. Publish the rule's project inputs.
 *  3. Assert only the positive glob is declared.
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs on a configuration whose Markdown reference selects `docs/**\/*.md` and `!docs/private/**`; assertDeclares requires the glob inputs to be exactly `docs/**\/*.md`.
 * @evidence contracts/testing.md#independent-expectations The expected set is authored from the host contract: the host's dependency model has no negation, so a negated pattern published as an input would be watched as a population, the inverse of what the author wrote.
 * @evidence contracts/testing.md#distinguishing-cases One positive and one negated pattern in the same selection: dropping the whole set would publish nothing and publishing the negation would add a second pattern, so the exact one-element set pins the filter to the negated pattern only.
 * @evidence contracts/testing.md#execution-ownership TestExclusionGlobsAreNotDeclaredAsInputs is a Go unit entry in the native test process; it calls ProjectInputs on an in-memory project input context with no sources, consumer install or product host.
 */
func TestExclusionGlobsAreNotDeclaredAsInputs(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md","!docs/private/**"],
      "symbol":"h2"
    }
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{"docs/**/*.md"})
}
