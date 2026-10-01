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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `@org/api` narrowed to `lib/questions/index.d.ts`, whose barrel re-exports get.d.ts and a `details` namespace of detail.d.ts, beside an unselected lib/reviews/erase.d.ts; the diagnostics must contain `Missing acknowledgement for 'questions.get'` and `Missing acknowledgement for 'questions.details.detail'` and none for `'erase'`.
 * @evidence contracts/testing.md#independent-expectations The expected addresses are authored from the package-entry addressing contract: an area narrowed by glob is a barrel plus the modules it re-exports, owed under the address the package entry gives them, while a neighboring area stays out.
 * @evidence contracts/testing.md#distinguishing-cases The matched barrel's re-exported module and nested namespace are demanded while the sibling area is not; only containment of the two demanded messages and the absence of `erase` are asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphPackageGlobsCarryTheirBarrelReExports is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
