package evidence

import (
  "testing"
)

/**
 * Verifies one data member restores the same claim.
 *
 * The firing twin of the complementary case, and the reason that one is not simply a
 * rule that stopped working. One member the classifier answers `property` for
 * is the whole difference between a silent build and a reported obligation, so
 * the pair also states the repair an upgrading consumer needs: name the kinds
 * the population really holds, or widen the selector.
 *
 *  1. Add a data member to the same interface, changing nothing else.
 *  2. Evaluate the same `property` claim.
 *  3. Assert the now-active claim reports its missing acknowledgement.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the now-active claim reports its missing acknowledgement.
 * @evidence contracts/testing.md#independent-expectations The firing twin of the complementary case, and the reason that one is not simply a rule that stopped working. One member the classifier answers `property` for is the whole difference between a silent build and a reported obligation, so the pair also states the repair an upgrading consumer needs: name the kinds the population really holds, or widen the selector.
 * @evidence contracts/testing.md#distinguishing-cases Add a data member to the same interface, changing nothing else. Evaluate the same `property` claim. Assert the now-active claim reports its missing acknowledgement.
 * @evidence contracts/testing.md#execution-ownership TestOneDataMemberReactivatesAPropertyClaimOverAnInterface is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
