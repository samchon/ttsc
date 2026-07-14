package linthost

import "testing"

// TestNoInnerDeclarationsDefaultFollowsStrictContext verifies canonical function mode.
//
// The default reports block functions only where legacy sloppy semantics can
// leak a binding. Real directive prologues, namespace prologues, and class code
// are strict, while late or parenthesized strings are not directives.
//
// 1. Mix sloppy, strict, class, static-block, and namespace declarations.
// 2. Run the rule without options.
// 3. Assert only functions in genuinely sloppy nested blocks are reported.
func TestNoInnerDeclarationsDefaultFollowsStrictContext(t *testing.T) {
  assertNoInnerDeclarationsCase(t, "default-strict-context.ts", `if (sloppyCondition) {
  // expect: no-inner-declarations error
  function sloppyNested() {}
}

if (sloppyCondition) {
  var ignoredByDefault = 1;
}

function strictOuter() {
  "use strict";
  if (strictCondition) {
    function strictNested() {}
  }
}

function lateDirectiveOuter() {
  void 0;
  "use strict";
  if (lateCondition) {
    // expect: no-inner-declarations error
    function lateDirectiveNested() {}
  }
}

function parenthesizedDirectiveOuter() {
  ("use strict");
  if (parenthesizedCondition) {
    // expect: no-inner-declarations error
    function parenthesizedDirectiveNested() {}
  }
}

function escapedDirectiveOuter() {
  "use\x20strict";
  if (escapedCondition) {
    // expect: no-inner-declarations error
    function escapedDirectiveNested() {}
  }
}

namespace StrictNamespace {
  "use strict";
  if (namespaceCondition) {
    function namespaceNested() {}
  }
}

class StrictClass {
  method() {
    if (methodCondition) {
      function methodNested() {}
    }
  }

  static {
    function staticRoot() {}
    if (staticCondition) {
      function staticNested() {}
    }
  }
}

const StrictClassExpression = class {
  method() {
    if (classExpressionCondition) {
      function classExpressionNested() {}
    }
  }
};

function rootFunction() {}
`, "")
}

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
