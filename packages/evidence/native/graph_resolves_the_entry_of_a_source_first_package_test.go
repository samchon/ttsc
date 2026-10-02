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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `@org/api` selecting `src/**`, where the manifest's `main` and `exports` both name `./src/index.ts` and the entry nests `functional` and `health` namespaces over a `get` function; assertProblemContains requires `Missing acknowledgement for 'functional.health.get'`.
 * @evidence contracts/testing.md#independent-expectations The expected address is authored from the entry-resolution contract: a source-first package's `exports` target is its entry, so units are addressed from the entry (`functional.health.get`) and not from the module that matched (`get`).
 * @evidence contracts/testing.md#distinguishing-cases A glob selection (membership) differs from the entry (addressing); if the TypeScript-source entry were refused, the unit would be addressed as `get` and the expected message would not appear.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesTheEntryOfASourceFirstPackage is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
