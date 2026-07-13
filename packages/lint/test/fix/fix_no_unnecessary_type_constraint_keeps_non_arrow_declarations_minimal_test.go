package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsNonArrowDeclarationsMinimal verifies
// TSX only receives a comma for arrow functions, not ordinary declarations.
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
