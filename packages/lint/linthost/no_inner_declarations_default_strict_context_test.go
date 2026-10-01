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
//
// @evidence contracts/testing.md#behavioral-verification Engine compares exact annotated diagnostics for genuinely sloppy nested functions without reporting strict class, namespace or directive contexts.
// @evidence contracts/testing.md#independent-expectations Real directive prologues create strict context while late, parenthesized and escaped strings do not; authored source annotations identify the independent sloppy sites.
// @evidence contracts/testing.md#distinguishing-cases Sloppy blocks report; real strict directives, namespace/class/static contexts and roots stay clean. Late/parenthesized/escaped strings remain distinct from strict directives.
// @evidence contracts/testing.md#execution-ownership TestNoInnerDeclarationsDefaultFollowsStrictContext is selected in the shared Go unit population. It calls assertNoInnerDeclarationsCase for default-strict-context.ts, parsing the actual source and running Engine with default options. No consumer install, native artifact build or real host runs.
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
