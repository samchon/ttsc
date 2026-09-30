package evidence

import "testing"

/**
 * Verifies a refused aggregate suppresses only what its own diagnostic named.
 *
 * Every other case cites a scope covering the whole population, so the suppression set and the population are indistinguishable there and a widened suppression passes unnoticed. The consequence is a host's remaining, unrelated shortfall disappearing behind an aggregate diagnostic that never mentioned it.
 *
 *  1. Select H3 items under two different H2 parents.
 *  2. Cite one unselected H2, which contains one of the two items.
 *  3. Assert the refusal names that item and the host still owes the other.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a refused aggregate suppresses only what its own diagnostic named. The original assertions check assert the refusal names that item and the host still owes the other.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Every other case cites a scope covering the whole population, so the suppression set and the population are indistinguishable there and a widened suppression passes unnoticed. The consequence is a host's remaining, unrelated shortfall disappearing behind an aggregate diagnostic that never mentioned it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select H3 items under two different H2 parents. Cite one unselected H2, which contains one of the two items. Assert the refusal names that item and the host still owes the other. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistSuppressesOnlyTheItemsARefusedAggregateNamed is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistSuppressesOnlyTheItemsARefusedAggregateNamed(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": `## Alpha {#alpha}

### One {#one}

## Beta {#beta}

### Two {#two}
`,
    "src/partial.ts": `/** @evidence docs/rules.md#alpha The first branch is honored. */
export function partial(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h3",
      "checklist":true
    }
  }]}`)
  assertProblemContains(t, messages, "Aggregate @evidence target 'docs/rules.md#alpha'")
  assertProblemContains(t, messages, "names a scope containing 1 item(s) ('docs/rules.md#one') rather than one of them")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#two'")
}
