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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `@org/api` narrowed to `lib/internal/**`, where the package entry publishes only `questions` and lib/internal/tool.d.ts is not re-exported by it; assertProblemContains requires `reachable from the package entry`.
 * @evidence contracts/testing.md#independent-expectations The expected message fragment is authored from the addressing contract: a unit the entry does not publish has no address a consumer can write, so selecting it yields an empty population that must be reported with the entry as the reason.
 * @evidence contracts/testing.md#distinguishing-cases A glob matching a real but unpublished module; the entry-published area is the contrast, and only containment of the reason fragment is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAPackageGlobOutsideTheEntrySurface is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
