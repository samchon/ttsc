package evidence

import "testing"

/**
 * Verifies duplicate and conflict detection carries the host under a checklist.
 *
 * Both keys are obligation-wide without this option, so two hosts excluding one item read as a duplicate and one host citing an item another excludes reads as a contradiction. Under a checklist both are the expected state, and the negative twin proves the keys still fire inside one host.
 *
 *  1. Cite an item from one host while two other hosts exclude it.
 *  2. Assert no duplicate or conflict is reported across those hosts.
 *  3. Cite and exclude the same item on one host and assert the conflict returns.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies duplicate and conflict detection carries the host under a checklist. The original assertions check cite and exclude the same item on one host and assert the conflict returns.
 * @evidence contracts/testing.md#independent-expectations Both keys are obligation-wide without this option, so two hosts excluding one item read as a duplicate and one host citing an item another excludes reads as a contradiction. Under a checklist both are the expected state, and the negative twin proves the keys still fire inside one host. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite an item from one host while two other hosts exclude it. Assert no duplicate or conflict is reported across those hosts. Cite and exclude the same item on one host and assert the conflict returns. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistJudgesDuplicatesAndConflictsPerHost is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistJudgesDuplicatesAndConflictsPerHost(t *testing.T) {
  document := "## Only rule {#only-rule}\n"
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`
  across := runIndexRule(t, map[string]string{
    "docs/rules.md": document,
    "src/cites.ts": `/** @evidence docs/rules.md#only-rule This module honors it. */
export function cites(): void {}
`,
    "src/first.ts": `/** @evidenceExclude docs/rules.md#only-rule Nothing here applies. */
export function first(): void {}
`,
    "src/second.ts": `/** @evidenceExclude docs/rules.md#only-rule Nothing here applies either. */
export function second(): void {}
`,
  }, config)
  assertNoProblems(t, across)

  within := runIndexRule(t, map[string]string{
    "docs/rules.md": document,
    "src/both.ts": `/**
 * @evidence docs/rules.md#only-rule This module honors it.
 * @evidenceExclude docs/rules.md#only-rule It does not apply.
 */
export function both(): void {}
`,
  }, config)
  assertProblemContains(t, within, "Conflicting acknowledgements for 'docs/rules.md#only-rule'")
}
