package evidence

import "testing"

/**
 * Verifies a declared `types` still wins over a TypeScript runtime entry.
 *
 * Following the runtime entry is the last resort, not a preference. A package
 * that names its declarations has said where they are, and reading its source
 * entry instead would address a different file than the one it publishes.
 *
 *  1. Declare `types` beside an `exports` target that names TypeScript source.
 *  2. Acknowledge only what the declarations expose.
 *  3. Assert silence, which is reachable only through `types`.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `@org/api` whose manifest has `types: ./lib/index.d.ts` and an `exports` target `./src/index.ts`; lib/index.d.ts declares only `get` while src/index.ts declares `get` and `erase`, and a view cites `{@link api.get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the entry-resolution contract: a package that names its declarations has said where they are, so `types` wins and following the TypeScript runtime entry is only a last resort; silence is reachable only if `erase` (declared in the source entry alone) is not part of the population.
 * @evidence contracts/testing.md#distinguishing-cases The two candidate entries differ by one function: reading the source entry would leave `erase` owed and fail, while reading the declarations leaves only the cited `get`.
 * @evidence contracts/testing.md#execution-ownership TestGraphPrefersDeclaredTypesOverATypeScriptRuntimeEntry is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphPrefersDeclaredTypesOverATypeScriptRuntimeEntry(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": `{
  "name": "@org/api",
  "types": "./lib/index.d.ts",
  "exports": { ".": "./src/index.ts" }
}`,
    "node_modules/@org/api/lib/index.d.ts": "export declare function get(): void;\n",
    "node_modules/@org/api/src/index.ts":   "export function get(): void {}\nexport function erase(): void {}\n",
    "src/views/detail.ts": `
import type * as api from "@org/api";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","symbol":"function"}
  }]}`))
}
