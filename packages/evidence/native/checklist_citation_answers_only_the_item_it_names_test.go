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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a citation answers the item it names and never the items beneath it. The original assertions check repeat with an explicit ancestor and descendant selection and assert the descendant survives its parent's citation.
 * @evidence contracts/testing.md#independent-expectations Refusing the unselected ancestor is not enough, and only this shape shows it. Under the default Markdown selector the file is itself an item, so one document citation resolves to a selected unit, and if that citation kept the ordinary subtree cascade it would discharge every heading on that host. The option would then be a no-op in the first configuration an adopter writes, with no diagnostic anywhere. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite the document under the default selector, where the file is an item and the headings are items too. Assert the file item is answered and both headings are still owed. Repeat with an explicit ancestor and descendant selection and assert the descendant survives its parent's citation. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCitationAnswersOnlyTheItemItNames is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
