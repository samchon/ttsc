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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a re-export resolves to the compiled source, not to emitted output beside it. The original assertions check assert the declaration from the TypeScript source is the obligation.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Under `nodenext` a TypeScript module spells its sibling as `./x.js`, and a project that emits beside its sources has a real `x.js` on disk answering to that exact name. Resolving there would read the emitted JavaScript, whose declarations the graph cannot address, and the population would silently lose everything the module publishes. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put a compiled `wide.js` on disk beside the `wide.ts` the Program holds. Re-export `./wide.js` from the selected barrel. Assert the declaration from the TypeScript source is the obligation. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesReExportsToProgramSourcesOverEmittedOutput is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
