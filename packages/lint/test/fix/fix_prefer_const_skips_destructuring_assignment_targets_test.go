package linthost

import "testing"

// TestFixPreferConstSkipsDestructuringAssignmentTargets verifies preferConst
// does not flag a `let` reassigned through a destructuring-assignment target.
//
// The reassignment scan used to count only simple `=`, compound-assignment,
// and `++`/`--` writes; a destructuring-assignment left-hand side parses as an
// ArrayLiteralExpression / ObjectLiteralExpression, not a binding pattern, so
// its identifiers were never marked reassigned. preferConst then flagged the
// binding and `ttsc fix` rewrote it to `const`, producing code that fails to
// compile (TS2588). `assignmentTargetNames` now walks those patterns —
// elements, property values, nested patterns, defaults, and rest — so the
// binding is correctly left as `let`.
//
//  1. Parse `let` bindings reassigned only via array, object, and nested
//     destructuring-assignment patterns.
//  2. Run preferConst through the disk-backed fixer.
//  3. Assert the rule reports nothing and the source is left unchanged.
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
