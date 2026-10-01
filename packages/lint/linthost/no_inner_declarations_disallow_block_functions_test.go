package linthost

import "testing"

// TestNoInnerDeclarationsDisallowReportsStrictBlockFunctions verifies style override.
//
// `blockScopedFunctions: "disallow"` deliberately reports nested functions
// even when ESM or class strictness makes their runtime semantics safe. Root
// declarations in programs, function bodies, static blocks, and export forms
// remain allowed, and `var` remains outside `"functions"` mode.
//
// 1. Configure the full canonical positional option tuple in an ESM source.
// 2. Mix nested strict functions with every allowed root and a nested `var`.
// 3. Assert only the nested functions are reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports exactly nested functions under the explicit disallow tuple, without widening to nested var or permitted roots.
// @evidence contracts/testing.md#independent-expectations The authored functions/disallow option deliberately overrides strict-context allowance; the authored `// expect` annotations on the four nested functions and the absence of one on the nested `var ignoredVariable` independently pin that scope.
// @evidence contracts/testing.md#distinguishing-cases ESM/method/static nested functions report; program/function/static/export roots and nested var remain clean under functions mode.
// @evidence contracts/testing.md#execution-ownership TestNoInnerDeclarationsDisallowReportsStrictBlockFunctions is selected in the shared Go unit population. It calls assertNoInnerDeclarationsCase for disallow-block-functions.ts with the actual two-slot option tuple through InlineRuleResolver and Engine. No consumer install, native artifact build or real host runs.
func TestNoInnerDeclarationsDisallowReportsStrictBlockFunctions(t *testing.T) {
  assertNoInnerDeclarationsCase(t, "disallow-block-functions.ts", `export {};

if (moduleCondition) {
  // expect: no-inner-declarations error
  function moduleNested() {}
  var ignoredVariable = 1;
}

function outer() {
  function functionRoot() {}
  if (innerCondition) {
    // expect: no-inner-declarations error
    function functionNested() {}
  }
}

class StrictClass {
  method() {
    if (methodCondition) {
      // expect: no-inner-declarations error
      function methodNested() {}
    }
  }

  static {
    function staticRoot() {}
    if (staticCondition) {
      // expect: no-inner-declarations error
      function staticNested() {}
    }
  }
}

export function exportedRoot() {}
export default function exportedDefaultRoot() {}
`, `["functions", {"blockScopedFunctions":"disallow"}]`)
}
