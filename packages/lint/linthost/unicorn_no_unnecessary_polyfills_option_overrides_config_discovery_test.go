package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsOptionOverridesConfigDiscovery verifies the
// resolution precedence: an explicit `targets` option wins over an on-disk
// Browserslist config that would decide the opposite way.
//
// The directory's `.browserslistrc` says `node 6` (which would report), but the
// option pins `node 0.12` (which still needs the polyfill), so the option must
// silence the rule. The outcome proves decision precedence, not whether the
// configuration file was read.
//
//  1. Materialize a `.browserslistrc` that alone would report.
//  2. Lint with `targets: {node: "0.12"}`.
//  3. Assert silence.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution supplies explicit targets beside a Browserslist file with the opposite decision, detecting a failure to honor option precedence.
// @evidence contracts/testing.md#independent-expectations The supported explicit-target precedence and Node 0.12 Object.assign boundary require silence independently of discovered production Node 6.
// @evidence contracts/testing.md#distinguishing-cases Explicit node 0.12 stays clean despite the on-disk production node 6; BrowserslistrcDiscovery owns its reported counterpart without the override.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsOptionOverridesConfigDiscovery owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsOptionOverridesConfigDiscovery(t *testing.T) {
  assertProjectClean(t, map[string]string{
    ".browserslistrc": "[production]\nnode 6\n\n[development]\nnode 0.12\n",
  }, "index.ts", `require("object-assign")`, `{"targets":{"node":"0.12"}}`)
}
