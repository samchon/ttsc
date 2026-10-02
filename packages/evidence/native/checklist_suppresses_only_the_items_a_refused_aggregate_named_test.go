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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with an h3 checklist over a document with `alpha` (child `one`) and `beta` (child `two`), where a function cites the unselected h2 `alpha`; the test requires `Aggregate @evidence target 'docs/rules.md#alpha'` naming a scope of 1 item (`docs/rules.md#one`), and `has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#two'`.
 * @evidence contracts/testing.md#independent-expectations The expected item lists are authored from the document structure: the refused aggregate names only the item it contains, so the suppression covers `one` and the other item `two` must still be owed by the host.
 * @evidence contracts/testing.md#distinguishing-cases The aggregate covers half of the population rather than all of it, which is what separates suppressing only the named items from suppressing the host's whole shortfall; a whole-population aggregate is owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestChecklistSuppressesOnlyTheItemsARefusedAggregateNamed is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
