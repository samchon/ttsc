package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a selected item is citable while a partially covering scope is not.
 *
 * The refusal is "this target is not one of the items", never "this target has descendants". A reference selecting both H2 and H3 makes an H2 an item *and* a scope, so citing it must stay legal, while the document that selects neither must stay refused — the boundary the aggregate rule turns on.
 *
 *  1. Select H2 and H3 as checklist items.
 *  2. Cite both from one host and cite the document from another.
 *  3. Assert only the document citation is refused, and the host that named the items directly is silent.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a checklist selecting h2 and h3 over a document with `no-hardcoding` and its child `fixtures`, where one host cites both headings and another cites the whole document; the test requires exactly one `Aggregate @evidence target` diagnostic, for `'docs/rules.md' at src/document.ts`, and no diagnostic naming `'section'`.
 * @evidence contracts/testing.md#independent-expectations The expected single refusal is authored from the aggregate contract that a target is refused because it is not a selected item, not because it has descendants: the h2 is both an item and a scope here, so citing it stays legal while the unselected document is refused.
 * @evidence contracts/testing.md#distinguishing-cases The h2 that also contains a selected h3 (must stay accepted) beside the document citation (must be refused) separates the selection-based rule from a descendant-based one; the same-reference default-selector case is owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestChecklistJudgesAnAggregateBySelectionRatherThanByDescendants is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistJudgesAnAggregateBySelectionRatherThanByDescendants(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": `## No hardcoding {#no-hardcoding}

### Fixtures {#fixtures}
`,
    "src/section.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#fixtures No fixture name is special-cased.
 */
export function section(): void {}
`,
    "src/document.ts": `/** @evidence docs/rules.md Everything in here is honored. */
export function document(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":["h2","h3"],
      "checklist":true
    }
  }]}`)
  if count := countProblemsContaining(messages, "Aggregate @evidence target"); count != 1 {
    t.Fatalf("expected only the document citation to be aggregate, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Aggregate @evidence target 'docs/rules.md' at src/document.ts")
  // The H2 is an item and a scope at once here, so a citation of it must not be
  // read as an aggregate of the H3 beneath it.
  if strings.Contains(strings.Join(messages, "\n"), "'section'") {
    t.Fatalf("citing a selected item that also contains one was refused:\n%s", strings.Join(messages, "\n"))
  }
}
