package linthost

import "testing"

// TestUnicornIsolatedFunctionsThisAndSuper verifies the `this` / `super`
// context walk of getFunctionContextProblems: an isolated function owns its
// `this`/`super`, a nested arrow shares that context, and a nested non-arrow
// function or class method owns its own context and stops the walk.
//
// Upstream reports every `ThisExpression`/`Super` reachable without crossing a
// new function context boundary; the arrow chain keeps the isolated context,
// while a nested regular function or class method introduces a fresh context
// whose `this` is its own, so those stay clean.
//
//  1. Assert direct `this` in an @isolated method, `super` in an @isolated
//     method, and both through a nested arrow are reported.
//  2. Assert a nested regular function's `this` and a nested class method's
//     `this` stay clean.
func TestUnicornIsolatedFunctionsThisAndSuper(t *testing.T) {
  comment := `follows comment "@isolated"`

  directThis := `class Base { foo = 1; }
class Example extends Base {
  /** @isolated */
  method() {
    return this.foo;
  }
}
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, directThis, ""),
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "this",
      message: unicornIsolatedFunctionsThisMessage(comment),
    },
  )

  directSuper := `class Base { foo = 1; }
class Example extends Base {
  /** @isolated */
  method() {
    return super.foo;
  }
}
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, directSuper, ""),
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "super",
      message: unicornIsolatedFunctionsSuperMessage(comment),
    },
  )

  // A nested arrow keeps the isolated function's lexical `this`/`super`, so
  // both are reported; upstream yields the ThisExpression before the Super in
  // source order.
  nestedArrow := `class Base { foo = 1; }
class Example extends Base {
  /** @isolated */
  method() {
    const getValue = () => this.foo + super.foo;
    return getValue;
  }
}
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, nestedArrow, ""),
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "this",
      message: unicornIsolatedFunctionsThisMessage(comment),
    },
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "super",
      message: unicornIsolatedFunctionsSuperMessage(comment),
    },
  )

  // A nested non-arrow function and a nested class method each own their
  // `this`; the isolated context walk must stop at their boundary, so both
  // are clean.
  nestedOwnContext := `/** @isolated */
function abc() {
  function getValue() {
    return this.value;
  }
  return class {
    method() {
      return this.value;
    }
  };
}
abc();
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, nestedOwnContext, ""),
  )
}
