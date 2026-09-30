package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsEnginesDiscovery verifies the final
// fallback: with neither option nor Browserslist config, the rule uses the
// nearest `package.json` `engines`.
//
// The two upstream issue-2270 fixtures pin the `array-from-async` boundary:
// still needed on the node 18 range, redundant on node 22.
//
//  1. `engines.node ">=18"` -> `array-from-async` still needed -> silent.
//  2. `engines.node "22"` -> redundant -> report.
// @evidence contracts/testing.md#behavioral-verification The rule resolves nearest package engines when neither explicit targets nor Browserslist configuration exists, exercising the real fallback through array-from-async.
// @evidence contracts/testing.md#independent-expectations Retained upstream issue-2270 inputs establish that Node >=18 includes runtimes needing Array.fromAsync whereas Node 22 already provides it.
// @evidence contracts/testing.md#distinguishing-cases The same import is clean under engines.node >=18 and reports under 22; separate hosts own explicit-option and Browserslist precedence.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsEnginesDiscovery owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsEnginesDiscovery(t *testing.T) {
  assertProjectClean(t, map[string]string{
    "package.json": `{"engines":{"node":">=18"}}`,
  }, "index.ts", `import x from "array-from-async"`, "")

  assertProjectReports(t, map[string]string{
    "package.json": `{"engines":{"node":"22"}}`,
  }, "index.ts", `import x from "array-from-async"`, "", polyfillMessageBuiltIn)
}
