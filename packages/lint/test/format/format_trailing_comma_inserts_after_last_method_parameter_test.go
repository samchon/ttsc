package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastMethodParameter verifies the rule
// reaches multi-line parameter lists on class method declarations.
//
// Method declarations live inside a `ClassDeclaration` body and dispatch
// through the `KindMethodDeclaration` arm with `AsMethodDeclaration()`. Pinning
// this case isolates the class-member parameter path from the top-level
// FunctionDeclaration path the existing test already covers — a future
// refactor that consolidated declaration-kind handling could drop method
// coverage silently, and class methods are the most common shape after
// top-level functions.
//
//  1. Parse a source file with one class containing a method whose parameter
//     list spans multiple lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the last parameter.
func TestFormatTrailingCommaInsertsAfterLastMethodParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "class Calculator {\n  add(\n    left: number,\n    right: number\n  ): number {\n    return left + right;\n  }\n}\nCalculator;\n",
    "class Calculator {\n  add(\n    left: number,\n    right: number,\n  ): number {\n    return left + right;\n  }\n}\nCalculator;\n",
  )
}
