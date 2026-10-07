package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario verifies the shipped
// corpus fixture's source-relative configuration behavior: a source file that imports a
// redundant polyfill next to a sibling `package.json` whose `engines.node`
// makes the polyfill unnecessary.
//
// The shipped corpus marks this rule as requiring resolved target input.
// This unit retains its object-assign import shape and supplies an authored
// source-directory manifest, independently of the corpus runner.
//
//  1. Place `src/main.ts` (importing `object-assign`) beside `src/package.json`.
//  2. Set `engines.node` to a version that already ships `Object.assign`.
//  3. Assert exactly one built-in diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification The unit rule discovers src/package.json from src/main.ts and reports redundant object-assign, exercising source-relative fixture resolution.
// @evidence contracts/testing.md#independent-expectations The authored engines.node 8 target already supplies Object.assign and independently requires the literal built-in diagnostic.
// @evidence contracts/testing.md#distinguishing-cases The source and its manifest are under src while the engine current directory is the temporary project root; this distinguishes source-directory lookup from using only a root manifest.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario(t *testing.T) {
  assertProjectReports(t, map[string]string{
    "src/package.json": `{"engines":{"node":"8"}}`,
  }, "src/main.ts", `import assign from "object-assign";
void assign;
`, "", polyfillMessageBuiltIn)
}
