package evidence

import "testing"

/**
 * Verifies a glob matching only modules the entry does not publish is reported.
 *
 * Such a unit has no address a consumer can write, so demanding an
 * acknowledgement for it would demand one nobody can discharge. Selecting
 * nothing is the honest answer and has to be a loud one, because an empty
 * population otherwise reads exactly like a satisfied obligation.
 *
 *  1. Install a package whose entry publishes one area and not another.
 *  2. Narrow the reference to the unpublished area.
 *  3. Assert the empty population names the entry as the reason.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a glob matching only modules the entry does not publish is reported. The original assertions check assert the empty population names the entry as the reason.
 * @evidence contracts/testing.md#independent-expectations Such a unit has no address a consumer can write, so demanding an acknowledgement for it would demand one nobody can discharge. Selecting nothing is the honest answer and has to be a loud one, because an empty population otherwise reads exactly like a satisfied obligation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Install a package whose entry publishes one area and not another. Narrow the reference to the unpublished area. Assert the empty population names the entry as the reason. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAPackageGlobOutsideTheEntrySurface is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReportsAPackageGlobOutsideTheEntrySurface(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export * as questions from "./questions/get.js";
`,
    "node_modules/@org/api/lib/questions/get.d.ts": "export declare function get(): void;\n",
    "node_modules/@org/api/lib/internal/tool.d.ts": "export declare function tool(): void;\n",
    "src/views/detail.ts":                          "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/internal/**"],"symbol":"function"}
  }]}`), "reachable from the package entry")
}
