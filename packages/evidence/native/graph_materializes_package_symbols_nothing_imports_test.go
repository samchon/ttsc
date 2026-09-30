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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a package reference materializes a symbol nothing imports. The original assertions check assert both are demanded, including the one nothing references.
 * @evidence contracts/testing.md#independent-expectations This is the reason the population is read from disk rather than the Program. An operation the frontend never called is absent from `ctx.Sources` by definition, and it is exactly the operation an obligation has to name — a graph that could only see imported symbols would report full coverage of the work already done. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Install a package declaring two operations and import neither. Select the package as evidence. Assert both are demanded, including the one nothing references. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphMaterializesPackageSymbolsNothingImports is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
