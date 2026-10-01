package evidence

import "testing"

/**
 * Verifies a re-export resolves to the compiled source, not to emitted output
 * beside it.
 *
 * Under `nodenext` a TypeScript module spells its sibling as `./x.js`, and a
 * project that emits beside its sources has a real `x.js` on disk answering to
 * that exact name. Resolving there would read the emitted JavaScript, whose
 * declarations the graph cannot address, and the population would silently lose
 * everything the module publishes.
 *
 *  1. Put a compiled `wide.js` on disk beside the `wide.ts` the Program holds.
 *  2. Re-export `./wide.js` from the selected barrel.
 *  3. Assert the declaration from the TypeScript source is the obligation.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a type reference over src/api/index.ts, where `export * from "./wide.js"` has both a TypeScript source `wide.ts` (declaring `IWide`) and a compiled `wide.js` beside it, and a view cites `{@link api.IWide}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the module-resolution contract: under nodenext the specifier `./wide.js` names the compiled sibling of `wide.ts`, and resolving to the emitted JavaScript would lose the module's declarations, so `IWide` must be reachable and cited.
 * @evidence contracts/testing.md#distinguishing-cases A real emitted `wide.js` on disk beside the source; if resolution read the JavaScript, `IWide` would be unreachable and the citation reported. Silence alone is the oracle.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesReExportsToProgramSourcesOverEmittedOutput is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphResolvesReExportsToProgramSourcesOverEmittedOutput(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/wide.ts":  "export interface IWide { value: string }\n",
    "src/api/wide.js":  "\"use strict\";\nexports.__esModule = true;\n",
    "src/api/index.ts": "export * from \"./wide.js\";\n",
    "src/views/detail.ts": `import type * as api from "./../api/index.js";

/** @evidence {@link api.IWide} Mirrors the wide contract. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/index.ts"],"symbol":"type"}
  }]}`)
  assertNoProblems(t, messages)
}
