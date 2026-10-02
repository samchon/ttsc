package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers verifies
// the specifier extractor mirrors upstream's listener exactly: it reports a
// static import, a dynamic `import()`, and a static `require()` of a redundant
// polyfill, but ignores every near-miss shape.
//
// Each negative is one property away from a reported form, so an over-broad
// matcher in the import or call path fails here. All cases share `node 8`
// targets, where `object-assign` is redundant, so a spurious match would report.
//
//  1. Assert the three canonical positive forms each report once.
//  2. Assert relative/absolute specifiers, member/optional/multi-arg require,
//     `import = require`, `export ... from`, and non-literal specifiers are all
//     silent.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run evaluates import, dynamic import and require ASTs and requires exact redundant-polyfill reports only for supported static-string shapes.
// @evidence contracts/testing.md#independent-expectations The supported source-shape contract and independently authored Node 8 Object.assign boundary establish both matching and redundancy.
// @evidence contracts/testing.md#distinguishing-cases Three reported forms contrast with relative/absolute paths, extra arguments, optional/member/template require, nonstatic dynamic import, reexports and import-equals; every original near-miss remains.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers(t *testing.T) {
  const options = `{"targets":{"node":"8"}}`

  // Positive controls: the three forms upstream reports.
  assertPolyfillReports(t, `import assign from "object-assign";`, options, polyfillMessageBuiltIn)
  assertPolyfillReports(t, `import("object-assign");`, options, polyfillMessageBuiltIn)
  assertPolyfillReports(t, `require("object-assign");`, options, polyfillMessageBuiltIn)

  // Negatives: every near-miss must stay silent.
  negatives := []string{
    `require("./object-assign");`,
    `require("/object-assign");`,
    `import assign from "./object-assign";`,
    `require("object-assign", extra);`,
    `require?.("object-assign");`,
    `foo.require("object-assign");`,
    "require(`object-assign`);",
    `import(objectAssignSpecifier);`,
    `export { assign } from "object-assign";`,
    `export * from "object-assign";`,
    `import obj = require("object-assign");`,
  }
  for _, source := range negatives {
    assertPolyfillClean(t, source, options)
  }
}
