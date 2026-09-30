package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario verifies the shipped
// corpus fixture's source-relative configuration behavior: a source file that imports a
// redundant polyfill next to a sibling `package.json` whose `engines.node`
// makes the polyfill unnecessary.
//
// The flat `// expect:` corpus runner cannot express `targets`, so the corpus
// fixture keeps its `@ttsc-corpus-skip`; this test is the behavioral stand-in,
// pinning the same discovery the corpus would exercise if it could.
//
//  1. Place `src/main.ts` (importing `object-assign`) beside `src/package.json`.
//  2. Set `engines.node` to a version that already ships `Object.assign`.
//  3. Assert exactly one built-in diagnostic.
// @evidence contracts/testing.md#behavioral-verification The unit rule discovers src/package.json from src/main.ts and reports redundant object-assign, exercising source-relative fixture resolution.
// @evidence contracts/testing.md#independent-expectations The authored engines.node 8 target already supplies Object.assign and independently requires the literal built-in diagnostic.
// @evidence contracts/testing.md#distinguishing-cases This host retains the original source-relative manifest/import shape; EnginesDiscovery and SilentWithoutResolvableTargets distinguish needed and absent target populations.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario(t *testing.T) {
  assertProjectReports(t, map[string]string{
    "src/package.json": `{"engines":{"node":"8"}}`,
  }, "src/main.ts", `import assign from "object-assign";
void assign;
`, "", polyfillMessageBuiltIn)
}
