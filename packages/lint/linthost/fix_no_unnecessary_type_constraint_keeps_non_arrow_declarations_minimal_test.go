package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsNonArrowDeclarationsMinimal verifies
// TSX only receives a comma for arrow functions, not ordinary declarations.
//
// @evidence contracts/testing.md#behavioral-verification The TSX fix removes harmless constraints from interface, alias, class, method and function declarations without arrow commas.
// @evidence contracts/testing.md#independent-expectations The four independently authored top-level declarations, carrying five constrained type parameters including the class method's U, retain their names, member/body syntax and ordinary <T>/<U> parameter forms.
// @evidence contracts/testing.md#distinguishing-cases These non-arrow declaration kinds contrast with TSX arrow syntax; matching the file extension alone must not insert commas.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintKeepsNonArrowDeclarationsMinimal owns all four declarations and their five constraints in one assertFixSnapshotFile call on declarations.tsx.
func TestFixNoUnnecessaryTypeConstraintKeepsNonArrowDeclarationsMinimal(t *testing.T) {
  source := "interface Box<T extends unknown> { value: T }\n" +
    "type Alias<T extends any> = T;\n" +
    "class Store<T extends unknown> { method<U extends any>(value: U): U { return value; } }\n" +
    "function identity<T extends unknown>(value: T): T { return value; }\n"
  expected := "interface Box<T> { value: T }\n" +
    "type Alias<T> = T;\n" +
    "class Store<T> { method<U>(value: U): U { return value; } }\n" +
    "function identity<T>(value: T): T { return value; }\n"
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "declarations.tsx",
    source,
    expected,
  )
}
