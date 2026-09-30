package evidence

import "testing"

/**
 * Verifies a source-first workspace package resolves its entry from `exports`.
 *
 * A pnpm TypeScript monorepo links a package that has no emit: its `exports`
 * target and `main` both name `./src/index.ts`, which is at once what a
 * consumer imports and where the declarations are. Refusing that target leaves
 * the reference with no entry, and units then publish under the module that
 * matched rather than under the specifier a citation can spell — the state that
 * turns `functional.health.get` into `get`.
 *
 *  1. Install a package whose `exports` names TypeScript source directly.
 *  2. Select it through a glob, so membership and addressing differ.
 *  3. Assert the obligation is addressed from the entry, not from the module.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a source-first workspace package resolves its entry from `exports`. The original assertions check assert the obligation is addressed from the entry, not from the module.
 * @evidence contracts/testing.md#independent-expectations A pnpm TypeScript monorepo links a package that has no emit: its `exports` target and `main` both name `./src/index.ts`, which is at once what a consumer imports and where the declarations are. Refusing that target leaves the reference with no entry, and units then publish under the module that matched rather than under the specifier a citation can spell — the state that turns `functional.health.get` into `get`. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Install a package whose `exports` names TypeScript source directly. Select it through a glob, so membership and addressing differ. Assert the obligation is addressed from the entry, not from the module. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesTheEntryOfASourceFirstPackage is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesTheEntryOfASourceFirstPackage(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": `{
  "name": "@org/api",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}`,
    "node_modules/@org/api/src/index.ts": `
export * as functional from "./functional/index";
`,
    "node_modules/@org/api/src/functional/index.ts": `
export * as health from "./health";
`,
    "node_modules/@org/api/src/functional/health.ts": `
export function get(): void {}
`,
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["src/**"],"symbol":"function"}
  }]}`), "Missing acknowledgement for 'functional.health.get'")
}
