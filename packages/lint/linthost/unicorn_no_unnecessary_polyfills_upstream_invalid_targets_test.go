package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsUpstreamInvalidTargets verifies every
// upstream `invalid` case whose targets come from the `targets` option, with
// the exact upstream message: the plain "Use built-in instead." for single
// features and prefix aliases, and the core-js-module message for multi-feature
// `core-js/*` entries whose features are all available.
//
// The two messages hinge on whether the specifier resolves to a `coreJsEntries`
// key (multi-feature) or a single polyfill pattern, so both are asserted
// verbatim across static import, dynamic import, and require forms.
//
//  1. Feed each specifier the exact upstream targets option.
//  2. Assert exactly one finding.
//  3. Assert the finding's message equals the upstream message id's text.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution checks every retained redundant-polyfill source/target case for one exact error finding, detecting missed compatibility decisions and wrong module messages.
// @evidence contracts/testing.md#independent-expectations Retained upstream invalid inputs and literal built-in/core-js diagnostic text establish reports. The test formatter interpolates the authored module name without calling the product formatter.
// @evidence contracts/testing.md#distinguishing-cases Original package, core-js/core-js-pure, feature, target and import distinctions remain; UpstreamValidTargets owns needed-feature and nonmatching counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsUpstreamInvalidTargets owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsUpstreamInvalidTargets(t *testing.T) {
  builtIn := polyfillMessageBuiltIn
  cases := []struct {
    source  string
    options string
    message string
  }{
    {`require("setprototypeof")`, `{"targets":"node >4"}`, builtIn},
    {`require("core-js/features/array/last-index-of")`, `{"targets":"node >6.5"}`, builtIn},
    {`require("core-js-pure/features/array/from")`, `{"targets":"node >7"}`, polyfillCoreJsMessage("core-js-pure/features/array/from")},
    {`require("core-js/features/array/from")`, `{"targets":"node >7"}`, polyfillCoreJsMessage("core-js/features/array/from")},
    {`require("core-js/features/array/flat")`, `{"targets":"node >16"}`, polyfillCoreJsMessage("core-js/features/array/flat")},
    {`require("core-js/stable/promise")`, `{"targets":"node >24"}`, polyfillCoreJsMessage("core-js/stable/promise")},
    {`import "core-js-pure/stable/array/flat"`, `{"targets":"node >16"}`, polyfillCoreJsMessage("core-js-pure/stable/array/flat")},
    {`require("core-js/features/regexp/escape")`, `{"targets":{"node":"24"}}`, polyfillCoreJsMessage("core-js/features/regexp/escape")},
    {`import "core-js/actual/array/to-spliced"`, `{"targets":{"node":"20"}}`, polyfillCoreJsMessage("core-js/actual/array/to-spliced")},
    {`import "core-js/full/array/to-spliced"`, `{"targets":{"node":"20"}}`, polyfillCoreJsMessage("core-js/full/array/to-spliced")},
    {`import "core-js/es/array/to-spliced"`, `{"targets":{"node":"20"}}`, builtIn},
    {`import "core-js/stable/array/to-spliced"`, `{"targets":{"node":"20"}}`, builtIn},
    {`require("es6-symbol")`, `{"targets":"node >15"}`, builtIn},
    {`require("code-point-at")`, `{"targets":"node >4"}`, builtIn},
    {`require("object.getownpropertydescriptors")`, `{"targets":"node >8"}`, builtIn},
    {`require("string.prototype.padstart")`, `{"targets":"node >8"}`, builtIn},
    {`require("p-finally")`, `{"targets":"node >10.4"}`, builtIn},
    {`require("promise-polyfill")`, `{"targets":"node >15"}`, builtIn},
    {`require("promiseall-settled-polyfill")`, `{"targets":{"node":"20"}}`, builtIn},
    {`require("es6-promise")`, `{"targets":"node >15"}`, builtIn},
    {`require("es.prototype.array.find")`, `{"targets":{"node":"20"}}`, builtIn},
    {`require("polyfill-es.prototype.array.find")`, `{"targets":{"node":"20"}}`, builtIn},
    {`require("object-assign")`, `{"targets":"node 6"}`, builtIn},
    {`import assign from "object-assign"`, `{"targets":"node 6"}`, builtIn},
    {`import("object-assign")`, `{"targets":"node 6"}`, builtIn},
    {`require("object-assign")`, `{"targets":"node >6"}`, builtIn},
    {`require("object-assign")`, `{"targets":"node 8"}`, builtIn},
    {`require("array-from")`, `{"targets":"node >7"}`, builtIn},
    {`require("array-find-index")`, `{"targets":"node >4.0.0"}`, builtIn},
    {`require("array-find-index")`, `{"targets":"node >4"}`, builtIn},
    {`require("array-find-index")`, `{"targets":"node 4"}`, builtIn},
    {`require("arrayevery-polyfill")`, `{"targets":{"node":"20"}}`, builtIn},
    {`require("mdn-polyfills/Array.prototype.findIndex")`, `{"targets":"node 4"}`, builtIn},
    {`require("weakmap-polyfill")`, `{"targets":"node 12"}`, builtIn},
    {`import regexpEscape from "regexp.escape"`, `{"targets":{"node":"24"}}`, builtIn},
    {`require("core-js/full/regexp/escape")`, `{"targets":{"node":"24"}}`, polyfillCoreJsMessage("core-js/full/regexp/escape")},
    {`import withResolvers from "promise.withresolvers"`, `{"targets":{"node":"22.0.0"}}`, builtIn},
  }
  for _, testCase := range cases {
    assertPolyfillReports(t, testCase.source, testCase.options, testCase.message)
  }
}
