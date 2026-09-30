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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a selected item is citable while a partially covering scope is not. The original assertions check assert only the document citation is refused, and the host that named the items directly is silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The refusal is "this target is not one of the items", never "this target has descendants". A reference selecting both H2 and H3 makes an H2 an item *and* a scope, so citing it must stay legal, while the document that selects neither must stay refused — the boundary the aggregate rule turns on. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select H2 and H3 as checklist items. Cite both from one host and cite the document from another. Assert only the document citation is refused, and the host that named the items directly is silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistJudgesAnAggregateBySelectionRatherThanByDescendants is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
