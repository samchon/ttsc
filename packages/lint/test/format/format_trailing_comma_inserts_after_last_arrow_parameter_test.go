package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastArrowParameter verifies the rule
// reaches multi-line parameter lists on arrow functions.
//
// Arrow functions are the only parameter-bearing Kind where the parens are
// optional (`a => ...`); the rule's `Visits()` arm only dispatches when an
// `ArrowFunction` AST node exists, and `findCloseTokenAfter` then walks the
// source to locate the `)`. Pinning the multi-line, fully-parenthesized arrow
// shape keeps both the dispatch arm and the close-paren scanner regression-safe
// — a future refactor that assumed `parameters.End()` was the close paren
// (mirroring the FunctionDeclaration test's stated trap) would silently miss
// the arrow case otherwise.
//
// 1. Parse a source file with one multi-line arrow function.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last parameter.
func TestFormatTrailingCommaInsertsAfterLastArrowParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const add = (\n  left: number,\n  right: number\n): number => left + right;\nadd;\n",
    "const add = (\n  left: number,\n  right: number,\n): number => left + right;\nadd;\n",
  )
}
