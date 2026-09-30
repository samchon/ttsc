package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDropsExtendsClause verifies the
// noUnnecessaryTypeConstraint fixer removes the ` extends any` clause.
//
// The constraint is meaningless when the rule fires, so deleting from the
// type parameter's name end through the constraint's end yields the same
// type semantics in a tighter form. The expression slot and surrounding
// commas must stay intact.
//
// 1. Parse a source file with `<T extends any>`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the clause is gone and the type parameter name remains.
//
// @evidence contracts/testing.md#behavioral-verification The type-constraint fix removes extends any from function box without adding an arrow-only comma.
// @evidence contracts/testing.md#independent-expectations Literal function box<T> output preserves value parameter, return annotation, function body and trailing use.
// @evidence contracts/testing.md#distinguishing-cases A function declaration contrasts with the singleton TSX arrow; this case owns a harmless constraint in a non-arrow declaration.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintDropsExtendsClause runs assertFixSnapshot for typescript/no-unnecessary-type-constraint and the disk applier.
func TestFixNoUnnecessaryTypeConstraintDropsExtendsClause(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-unnecessary-type-constraint",
    "function box<T extends any>(value: T): T { return value; }\nJSON.stringify(box);\n",
    "function box<T>(value: T): T { return value; }\nJSON.stringify(box);\n",
  )
}
