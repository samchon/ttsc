package linthost

import "testing"

// TestNoInnerDeclarationsBothModeChecksEveryNestedVarForm verifies variable mode.
//
// The positional `"both"` mode extends checking to `var` without affecting
// `let`, `const`, root declarations, or the default strict-function allowance.
// Loop-header declarations and nested static-block declarations are part of
// the same hoisting hazard as statement-level `var`.
//
// 1. Place `var` in blocks, loop headers, functions, namespaces, and static blocks.
// 2. Keep root `var`, lexical declarations, and a strict block function nearby.
// 3. Assert every nested `var` and no safe twin is reported.
func TestNoInnerDeclarationsBothModeChecksEveryNestedVarForm(t *testing.T) {
  assertNoInnerDeclarationsCase(t, "both-mode.ts", `var programRoot = 0;

if (condition) {
  // expect: no-inner-declarations error
  var nestedStatement = 1;
  let blockLet = 2;
  const blockConst = 3;
}

// expect: no-inner-declarations error
for (var loopIndex = 0; loopIndex < 1; loopIndex++) {}

function outer() {
  var functionRoot = 0;
  if (condition) {
    // expect: no-inner-declarations error
    var functionNested = 1;
  }
}

namespace NamespaceRoot {
  var namespaceRoot = 0;
  if (condition) {
    // expect: no-inner-declarations error
    var namespaceNested = 1;
  }
}

class StaticRoot {
  static {
    var staticRoot = 0;
    if (condition) {
      // expect: no-inner-declarations error
      var staticNested = 1;
    }
  }
}

function strictOuter() {
  "use strict";
  if (condition) {
    function strictNested() {}
    // expect: no-inner-declarations error
    var strictNestedVariable = 1;
  }
}

if (condition) {
  // expect: no-inner-declarations error
  function sloppyNested() {}
}
`, `"both"`)
}
