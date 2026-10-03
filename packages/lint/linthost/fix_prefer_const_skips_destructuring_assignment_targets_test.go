package linthost

import "testing"

// TestFixPreferConstSkipsDestructuringAssignmentTargets verifies preferConst
// does not flag a `let` reassigned through a destructuring-assignment target.
//
// A destructuring-assignment left-hand side parses as an array or object
// expression, not a binding pattern. The actual assignmentTargetIdentifiers
// traversal collects element, property-value, nested, default, and rest
// targets; checker symbols connect them to the mutable declarations. The
// zero-finding oracle forbids changing those bindings to const, without
// asserting a compiler diagnostic or executing the rewritten program.
//
//  1. Parse `let` bindings reassigned only via array, object, and nested
//     destructuring-assignment patterns.
//  2. Run preferConst over the disk-backed source file.
//  3. Assert the rule reports nothing, so no `const` rewrite can be offered.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const emits no findings for bindings written only through array/object/nested destructuring assignments.
// @evidence contracts/testing.md#independent-expectations The authored assignment targets, rest and defaults require mutable bindings; zero findings forbid any const edit.
// @evidence contracts/testing.md#distinguishing-cases Array elements, object shorthand, rest and nested/default targets all count as writes rather than mere reads.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstSkipsDestructuringAssignmentTargets calls assertRuleSkipsSource through the real Program/checker on its full matrix.
func TestFixPreferConstSkipsDestructuringAssignmentTargets(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-const",
    "let x = 1;\n"+
      "let y = 2;\n"+
      "[x, y] = [y, x];\n"+
      "let a = 1;\n"+
      "const obj = { a: 9 };\n"+
      "({ a } = obj);\n"+
      "let head = 0;\n"+
      "let rest: number[] = [];\n"+
      "[head, ...rest] = [1, 2, 3];\n"+
      "let nested = 0;\n"+
      "let withDefault = 0;\n"+
      "[[nested], { withDefault = 7 }] = [[5], {}];\n"+
      "JSON.stringify([x, y, a, head, rest, nested, withDefault]);\n",
  )
}
