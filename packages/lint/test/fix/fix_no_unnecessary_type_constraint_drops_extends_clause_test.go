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
func TestFixNoUnnecessaryTypeConstraintDropsExtendsClause(t *testing.T) {
  assertFixSnapshot(
    t,
    "noUnnecessaryTypeConstraint",
    "function box<T extends any>(value: T): T { return value; }\nJSON.stringify(box);\n",
    "function box<T>(value: T): T { return value; }\nJSON.stringify(box);\n",
  )
}
