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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function-host checklist over a one-item document: one host cites the item while two others exclude it, which must give no diagnostics; a single host that both cites and excludes the same item must give `Conflicting acknowledgements for 'docs/rules.md#only-rule'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the checklist contract that each host answers every item independently, so the same item being cited and excluded on different hosts, or excluded twice, is the expected state, while a contradiction within one host is still a conflict.
 * @evidence contracts/testing.md#distinguishing-cases Across-host cite and double exclusion (must be silent) against within-host cite plus exclude (must conflict): the first would be reported as duplicate and conflict if the keys were obligation-wide, the second would be silent if they ignored the host.
 * @evidence contracts/testing.md#execution-ownership TestChecklistJudgesDuplicatesAndConflictsPerHost is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
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
