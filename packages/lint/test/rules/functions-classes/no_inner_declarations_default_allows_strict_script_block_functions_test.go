package linthost

import "testing"

// TestNoInnerDeclarationsDefaultAllowsStrictScriptBlockFunctions verifies a
// source-file directive prologue.
//
// A real top-level `"use strict"` directive makes the entire script strict,
// including nested function bodies. The default option must therefore allow
// block functions at both depths without confusing the source with a module.
//
// 1. Start an otherwise ordinary script with a real strict directive.
// 2. Place block functions at program and nested-function depth.
// 3. Assert the default rule emits no diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires no findings for block functions at script and nested-function depths after a true top-level strict directive.
// @evidence contracts/testing.md#independent-expectations A source-file directive prologue propagates strictness independently of module detection; the literal empty finding set follows the default allow-strict policy.
// @evidence contracts/testing.md#distinguishing-cases This owns a strict ordinary script at both depths; DefaultFollowsStrictContext owns sloppy and invalid-directive counterparts, and DefaultAllowsModuleBlockFunctions owns ESM.
// @evidence contracts/testing.md#execution-ownership TestNoInnerDeclarationsDefaultAllowsStrictScriptBlockFunctions is selected in the shared Go unit population. It calls assertNoInnerDeclarationsCase for default-strict-script.ts in-process with default rule options. No consumer install, native artifact build or real host runs.
func TestNoInnerDeclarationsDefaultAllowsStrictScriptBlockFunctions(t *testing.T) {
  assertNoInnerDeclarationsCase(t, "default-strict-script.ts", `'use strict';

if (programCondition) {
  function programNested() {}
}

function outer() {
  if (functionCondition) {
    function functionNested() {}
  }
}
`, "")
}
