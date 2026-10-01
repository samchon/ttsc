package evidence

import "testing"

/**
 * Verifies a package reference materializes a symbol nothing imports.
 *
 * This is the reason the population is read from disk rather than the Program.
 * An operation the frontend never called is absent from `ctx.Sources` by
 * definition, and it is exactly the operation an obligation has to name — a
 * graph that could only see imported symbols would report full coverage of the
 * work already done.
 *
 *  1. Install a package declaring two operations and import neither.
 *  2. Select the package as evidence.
 *  3. Assert both are demanded, including the one nothing references.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a TypeScript package reference `@org/api` whose installed declaration file declares `get` and `erase` while no source imports either; the diagnostics must contain `Missing acknowledgement for 'get'` and `Missing acknowledgement for 'erase'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the contract that a package population is read from disk, not from the Program: an operation the frontend never imported is exactly the one an obligation must name, so both declared functions are owed.
 * @evidence contracts/testing.md#distinguishing-cases Two declared operations with no import of either; a population limited to imported symbols would report neither. Only containment of the two messages is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphMaterializesPackageSymbolsNothingImports is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphMaterializesPackageSymbolsNothingImports(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export declare function get(): void;
export declare function erase(): void;
`,
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'get'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'erase'")
}
