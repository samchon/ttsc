package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsPackageJsonBrowserslistSection verifies the
// rule reads a sectioned `browserslist` object from `package.json` (not just a
// standalone `.browserslistrc`), selecting the `production` section.
//
//  1. `package.json` carries `browserslist.production = ["node 6"]`.
//  2. `object-assign` is redundant on node 6 -> report.
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run reads sectioned browserslist from a real fixture package manifest, distinguishing production selection from the development section.
// @evidence contracts/testing.md#independent-expectations The supported production default and independently authored Node 6/0.12 compatibility boundaries establish object-assign redundancy.
// @evidence contracts/testing.md#distinguishing-cases Production 6/development 0.12 reports; production 0.12/development 6 is clean. The standalone-file host owns the same environment distinction.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsPackageJsonBrowserslistSection owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsPackageJsonBrowserslistSection(t *testing.T) {
  assertProjectReports(t, map[string]string{
    "package.json": `{"browserslist":{"production":["node 6"],"development":["node 0.12"]}}`,
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)
  assertProjectClean(t, map[string]string{
    "package.json": `{"browserslist":{"production":["node 0.12"],"development":["node 6"]}}`,
  }, "index.ts", `require("object-assign")`, "")
}
