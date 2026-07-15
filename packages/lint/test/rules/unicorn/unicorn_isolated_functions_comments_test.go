package linthost

import "testing"

// TestUnicornIsolatedFunctionsComments verifies the comment-marker path of
// reasonForBeingIsolatedFunction and findComment: the `@isolated` marker is
// recognized on the function itself and on the variable, export, and property
// declarations a comment can apply to, across block, JSDoc, and line comment
// shapes including trailing explanations.
//
// Upstream strips one leading `*`-margin run, lowercases, trims, and accepts
// the bare marker or `marker - ` / `marker -- ` prefixes; the comment must be
// the token immediately before the (possibly hoisted) declaration.
//
//  1. Assert declaration, arrow, inline, block, multiline-JSDoc, explanation,
//     export const/default, object method, and object property forms report.
//  2. Assert a non-matching marker and a marker separated by another statement
//     stay clean.
func TestUnicornIsolatedFunctionsComments(t *testing.T) {
  reason := `follows comment "@isolated"`
  captured := func(line int) unicornIsolatedFunctionsFinding {
    return unicornIsolatedFunctionsFinding{
      line:    line,
      target:  "foo",
      message: unicornIsolatedFunctionsVariableMessage("foo", reason),
    }
  }

  source := `const foo = "hi";

/** @isolated */
function declaration() {
  return foo.slice();
}
declaration();

/** @isolated */
const arrow = () => foo.slice();

// @isolated
const inlineArrow = () => foo.slice();

/* @isolated */
const blockArrow = () => foo.slice();

/**
 * @isolated
 */
const jsdocArrow = () => foo.slice();

// @isolated - explanation
const dashArrow = () => foo.slice();

// @isolated -- explanation
const doubleDashArrow = () => foo.slice();

// @isolated
export const exportedArrow = () => foo.slice();

// @isolated
export default () => foo.slice();

const objectMethod = {
  /** @isolated */
  method() {
    return foo.slice();
  },
  /** @isolated */
  propertyArrow: () => foo.slice(),
  /** @isolated */
  propertyFunction: function () {
    return foo.slice();
  },
};
objectMethod.method();
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    captured(5),  // declaration
    captured(10), // arrow
    captured(13), // inlineArrow
    captured(16), // blockArrow
    captured(21), // jsdocArrow
    captured(24), // dashArrow
    captured(27), // doubleDashArrow
    captured(30), // exportedArrow
    captured(33), // export default
    captured(38), // object method
    captured(41), // property arrow
    captured(44), // property function
  )

  // Negative twins: a marker the option does not list, and a matching marker
  // that is not the token immediately before the declaration, isolate nothing.
  clean := `const foo = "hi";

/** @other */
const notMarked = () => foo.slice();

// @isolated
const separated = 1;
const afterSeparated = () => foo.slice();
`
  assertUnicornIsolatedFunctionsFindings(t, runUnicornIsolatedFunctions(t, clean, ""))

  // Custom comments replace the defaults: @remote now isolates, @isolated no
  // longer does.
  custom := `const foo = "hi";

// @remote
const remote = () => foo.slice();

// @isolated
const isolated = () => foo.slice();
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, custom, `{"comments": ["@remote"]}`),
    unicornIsolatedFunctionsFinding{
      line:    4,
      target:  "foo",
      message: unicornIsolatedFunctionsVariableMessage("foo", `follows comment "@remote"`),
    },
  )
}
