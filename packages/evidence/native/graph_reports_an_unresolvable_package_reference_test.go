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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an uninstalled package is reported rather than silently empty. The original assertions check assert the failure names the package and the entry resolution order.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A population that resolves to nothing produces no obligations, and coverage would then pass. Naming the resolution order tells the author which of the three manifest fields to correct. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select a package that is not installed. Evaluate the graph. Assert the failure names the package and the entry resolution order. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReportsAnUnresolvablePackageReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
