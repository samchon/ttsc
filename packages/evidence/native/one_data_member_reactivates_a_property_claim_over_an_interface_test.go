package evidence

import "testing"

/**
 * Verifies one data member restores the same claim.
 *
 * The firing twin of the case above, and the reason that one is not simply a
 * rule that stopped working. One member the classifier answers `property` for
 * is the whole difference between a silent build and a reported obligation, so
 * the pair also states the repair an upgrading consumer needs: name the kinds
 * the population really holds, or widen the selector.
 *
 *  1. Add a data member to the same interface, changing nothing else.
 *  2. Evaluate the same `property` claim.
 *  3. Assert the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies one data member restores the same claim. The original assertions check assert the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The firing twin of the case above, and the reason that one is not simply a rule that stopped working. One member the classifier answers `property` for is the whole difference between a silent build and a reported obligation, so the pair also states the repair an upgrading consumer needs: name the kinds the population really holds, or widen the selector. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Add a data member to the same interface, changing nothing else. Evaluate the same `property` claim. Assert the now-active claim reports its missing acknowledgement. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOneDataMemberReactivatesAPropertyClaimOverAnInterface is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestOneDataMemberReactivatesAPropertyClaimOverAnInterface(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/listener.ts": "export interface IListener {\n" +
      "  onOpen(): void;\n" +
      "  onMessage: (data: string) => void;\n" +
      "  id: string;\n" +
      "}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#contract'")
}
