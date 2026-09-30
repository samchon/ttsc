package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require only the positive glob is declared.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The host's dependency model has no negation, so a declared `!docs/private/**` would be read as a population to watch; the exact inverse of what the author wrote. The positive twin in the same case is what proves the filter discards only the exclusion instead of discarding the set.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a Markdown reference with one positive and one negative glob. Publish the rule's project inputs. Assert only the positive glob is declared.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestExclusionGlobsAreNotDeclaredAsInputs is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
