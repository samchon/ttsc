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
// 4. Distinguish imported names from local aliases and assert the sorted twin stays silent.
//
// @evidence contracts/testing.md#behavioral-verification The fs read/write list must reorder without changing module or uses. Aliased names must sort by local a/z while preserving their imported names, and that authored canonical alias list must emit no findings.
// @evidence contracts/testing.md#independent-expectations Supported named-import sorting uses accessible local binding names. Literal outputs independently order read before write and a before z while retaining export-to-local mappings and body bytes.
// @evidence contracts/testing.md#distinguishing-cases One declaration isolates local specifier sorting from runtime block rewriting. The alias fixture has export order opposite local order, and its sorted twin is negative; comment-bearing lists belong to a separate protection host.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsAlphabetizesNamedSpecifiers owns the original fs snapshot, authored alias transformation and canonical alias negative in the selected public Go unit population. Syntax-only owning rule and fixture edits execute in one Go process without native builds, consumer installation or product-host children.
func TestFormatSortImportsAlphabetizesNamedSpecifiers(t *testing.T) {
  source := "import { writeFileSync, readFileSync } from \"node:fs\";\n" +
    "readFileSync; writeFileSync;\n"
  expected := "import { readFileSync, writeFileSync } from \"node:fs\";\n" +
    "readFileSync; writeFileSync;\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
  assertFixSnapshot(t, "format/sort-imports", "import { a as z, z as a } from \"m\";\nconsole.log(a, z);\n", "import { z as a, a as z } from \"m\";\nconsole.log(a, z);\n")
  assertRuleSkipsSource(t, "format/sort-imports", "import { z as a, a as z } from \"m\";\nconsole.log(a, z);\n")
}
