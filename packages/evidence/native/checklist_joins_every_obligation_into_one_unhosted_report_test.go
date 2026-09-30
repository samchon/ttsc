package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies one declaration unhosted in several obligations draws one report naming all of them.
 *
 * The eager report was per reference, so one tag drew one message per checklist that recorded it. The deferred report is per declaration, and nothing else pins that: a regression emitting one message per obligation, or dropping an obligation from the join, leaves every other arm green.
 *
 *  1. Record one carrier exclusion in two checklist references over one document, with nothing consuming it.
 *  2. Assert exactly one unhosted report fires.
 *  3. Assert it names both obligations and the selected host kinds the repair points at.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies one declaration unhosted in several obligations draws one report naming all of them. The original assertions check assert it names both obligations and the selected host kinds the repair points at.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The eager report was per reference, so one tag drew one message per checklist that recorded it. The deferred report is per declaration, and nothing else pins that: a regression emitting one message per obligation, or dropping an obligation from the join, leaves every other arm green. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Record one carrier exclusion in two checklist references over one document, with nothing consuming it. Assert exactly one unhosted report fires. Assert it names both obligations and the selected host kinds the repair points at. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistJoinsEveryObligationIntoOneUnhostedReport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistJoinsEveryObligationIntoOneUnhostedReport(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":["function","property"],
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "Unhosted"); count != 1 {
    t.Fatalf("expected one joined report, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "for Claim 1 reference 1 (markdown, symbols: h2); Claim 1 reference 2 (markdown, symbols: h2)")
  // Two selected kinds pin that the parenthetical is derived deterministically
  // from the claim's selection rather than spelled anywhere as a literal.
  assertProblemContains(t, messages, "Move the tag onto a host of a selected kind (function, property) in a claim that owes it")
}
