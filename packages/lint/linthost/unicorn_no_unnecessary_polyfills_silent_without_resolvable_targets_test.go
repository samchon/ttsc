package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsSilentWithoutResolvableTargets verifies the
// rule stays silent when no targets resolve at all: no option, no Browserslist
// config, and a nearest `package.json` that carries no `engines`.
//
// This is the branch upstream's `getTargets` returns `undefined` for; without
// it the rule would either crash or fabricate a target and over-report.
//
//  1. Materialize a `package.json` with neither `browserslist` nor `engines`.
//  2. Import a normally-redundant polyfill.
//  3. Assert silence.
// @evidence contracts/testing.md#behavioral-verification The rule executes against a nearest package manifest with neither engines nor browserslist and must report nothing rather than fabricate targets.
// @evidence contracts/testing.md#independent-expectations Without resolvable targets the conservative contract cannot prove redundancy; this literal no-target input independently requires silence.
// @evidence contracts/testing.md#distinguishing-cases Ordinary package name/version content supplies no target source; EnginesDiscovery and BrowserslistrcDiscovery own resolvable counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsSilentWithoutResolvableTargets owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsSilentWithoutResolvableTargets(t *testing.T) {
  assertProjectClean(t, map[string]string{
    "package.json": `{"name":"fixture","version":"1.0.0"}`,
  }, "index.ts", `require("object-assign")`, "")
}
