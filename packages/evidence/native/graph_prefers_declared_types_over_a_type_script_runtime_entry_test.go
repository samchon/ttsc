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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a declared `types` still wins over a TypeScript runtime entry. The original assertions check assert silence, which is reachable only through `types`.
 * @evidence contracts/testing.md#independent-expectations Following the runtime entry is the last resort, not a preference. A package that names its declarations has said where they are, and reading its source entry instead would address a different file than the one it publishes. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Declare `types` beside an `exports` target that names TypeScript source. Acknowledge only what the declarations expose. Assert silence, which is reachable only through `types`. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphPrefersDeclaredTypesOverATypeScriptRuntimeEntry is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
