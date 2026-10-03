package evidence

import "testing"

/**
 * Verifies an uninstalled package is reported rather than silently empty.
 *
 * A population that resolves to nothing produces no obligations, and coverage
 * would then pass. Naming the resolution order tells the author which of the
 * three manifest fields to correct.
 *
 *  1. Select a package that is not installed.
 *  2. Evaluate the graph.
 *  3. Assert the failure names the package and the entry resolution order.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a TypeScript reference to the uninstalled package `@org/absent`; assertProblemContains requires `could not resolve the declaration entry of package '@org/absent'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the population contract: a package that resolves to nothing would produce no obligations and coverage would pass, so the failure must name the package and its entry resolution.
 * @evidence contracts/testing.md#distinguishing-cases A package that is not installed at all; an installed package whose glob matches nothing or whose entry does not publish the glob are owned by sibling entries. Only containment of the one fragment is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAnUnresolvablePackageReference is a Go unit entry in the native test process; runIndexRule writes the fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReportsAnUnresolvablePackageReference(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/absent","symbol":"function"}
  }]}`), "could not resolve the declaration entry of package '@org/absent'")
}
