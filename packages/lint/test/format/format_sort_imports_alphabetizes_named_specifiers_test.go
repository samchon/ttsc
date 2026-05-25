package linthost

import "testing"

// TestFormatSortImportsAlphabetizesNamedSpecifiers verifies the
// specifier-level pass reorders `{ b, a }` into `{ a, b }`.
//
// Specifier sorting is the in-import portion of the rule's contract. The
// block-level pass leaves untouched imports already in canonical order, so
// the specifier pass exists to keep diffs small inside a single import
// statement. This scenario isolates that pass: one import declaration, no
// block-level reorder.
//
// 1. Parse a source file with one import whose specifiers are out of order.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file has the specifiers in alphabetical order.
func TestFormatSortImportsAlphabetizesNamedSpecifiers(t *testing.T) {
  source := "import { writeFileSync, readFileSync } from \"node:fs\";\n" +
    "readFileSync; writeFileSync;\n"
  expected := "import { readFileSync, writeFileSync } from \"node:fs\";\n" +
    "readFileSync; writeFileSync;\n"
  assertFixSnapshot(t, "formatSortImports", source, expected)
}
