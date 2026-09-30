package evidence

import "testing"

/**
 * Verifies a package glob carries in what its matched barrel re-exports.
 *
 * A generated SDK narrowed to one area is a barrel plus the modules under it,
 * and the barrel is what a consumer imports. Taking only the declarations that
 * happen to sit in a matched `.d.ts` would leave the area's own surface partly
 * outside its obligation while the glob still reads as selecting that area.
 *
 *  1. Publish an area whose barrel re-exports a module beside it.
 *  2. Narrow the reference to the area alone.
 *  3. Assert the re-exported operation is demanded under the address the package
 *     entry gives it, and a neighbouring area still stays out.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a package glob carries in what its matched barrel re-exports. The original assertions check assert the re-exported operation is demanded under the address the package entry gives it, and a neighbouring area still stays out.
 * @evidence contracts/testing.md#independent-expectations A generated SDK narrowed to one area is a barrel plus the modules under it, and the barrel is what a consumer imports. Taking only the declarations that happen to sit in a matched `.d.ts` would leave the area's own surface partly outside its obligation while the glob still reads as selecting that area. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Publish an area whose barrel re-exports a module beside it. Narrow the reference to the area alone. Assert the re-exported operation is demanded under the address the package entry gives it, and a neighbouring area still stays out. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphPackageGlobsCarryTheirBarrelReExports is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphPackageGlobsCarryTheirBarrelReExports(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export * as questions from "./questions/index.js";
`,
    "node_modules/@org/api/lib/questions/index.d.ts": `
export * from "./get.js";
export * as details from "./detail.js";
`,
    "node_modules/@org/api/lib/questions/get.d.ts":    "export declare function get(): void;\n",
    "node_modules/@org/api/lib/questions/detail.d.ts": "export declare function detail(): void;\n",
    "node_modules/@org/api/lib/reviews/erase.d.ts":    "export declare function erase(): void;\n",
    "src/views/detail.ts":                             "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/questions/index.d.ts"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'questions.get'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'questions.details.detail'")
  if countProblemsContaining(messages, "Missing acknowledgement for 'erase'") != 0 {
    t.Fatalf("a barrel traversal reached outside the area its glob selected:\n%v", messages)
  }
}
