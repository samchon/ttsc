package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation answers the item it names and never the items beneath it.
 *
 * Refusing the unselected ancestor is not enough, and only this shape shows it. Under the default Markdown selector the file is itself an item, so one document citation resolves to a selected unit, and if that citation kept the ordinary subtree cascade it would discharge every heading on that host. The option would then be a no-op in the first configuration an adopter writes, with no diagnostic anywhere.
 *
 *  1. Cite the document under the default selector, where the file is an item and the headings are items too.
 *  2. Assert the file item is answered and both headings are still owed.
 *  3. Repeat with an explicit ancestor and descendant selection and assert the descendant survives its parent's citation.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule twice: with the default Markdown selector a function cites `docs/rules.md` (the file item) and the test requires no `Aggregate @evidence target` refusal plus `has not acknowledged 2 of 3 checklist item(s)` naming both headings; with an explicit h2/h3 selector a citation of the h2 heading must leave `1 of 2` owing `docs/rules.md#fixtures`.
 * @evidence contracts/testing.md#independent-expectations The expected counts (3 items and 2 owed; 2 items and 1 owed) are authored from the contract that a checklist citation answers only the item it names and never its descendants, so the usual subtree cascade must not discharge headings.
 * @evidence contracts/testing.md#distinguishing-cases The file-as-item case and the explicit ancestor/descendant case are the two shapes where a cascade would discharge descendants; the first also checks the file citation is legal rather than refused as an aggregate. The aggregate refusal itself is owned by a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCitationAnswersOnlyTheItemItNames is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestChecklistCitationAnswersOnlyTheItemItNames(t *testing.T) {
  defaulted := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/** @evidence docs/rules.md This module honors the document itself. */
export function broad(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "checklist":true
    }
  }]}`)
  // The file is a selected item here, so the citation is legal and answers one
  // item. Refusing it as an aggregate would be the opposite error.
  if strings.Contains(strings.Join(defaulted, "\n"), "Aggregate @evidence target") {
    t.Fatalf("a citation of a selected file item was refused as an aggregate:\n%s", strings.Join(defaulted, "\n"))
  }
  assertProblemContains(t, defaulted, "has not acknowledged 2 of 3 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")

  nested := runIndexRule(t, map[string]string{
    "docs/rules.md": `## No hardcoding {#no-hardcoding}

### Fixtures {#fixtures}
`,
    "src/section.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function section(): void {}
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
  assertProblemContains(t, nested, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#fixtures'")
}
