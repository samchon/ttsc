package linthost

import "testing"

// TestFormatSemiHonorsPreferNeverOption verifies the `prefer: "never"`
// branch strips trailing semicolons from ASI-safe statements while
// leaving class properties and type aliases alone.
//
// Stripping the `;` after a class field can change how the next token
// parses (e.g. `class A { x: number; [k](): void {} }` would reparse
// `[k]` as a computed index access on `number`). The rule's
// preferNeverSafeKind allowlist exists to pin that boundary. This test
// exercises both halves: an ASI-safe expression statement *and* a
// PropertyDeclaration in the same fixture and asserts the asymmetric
// rewrite.
//
//  1. Parse a file with both a statement and a class field, both ending
//     in `;`, with `prefer: "never"` configured.
//  2. Apply the rule's findings through the disk-backed fixer.
//  3. Assert the statement loses its `;` but the class field keeps it.
func TestFormatSemiHonorsPreferNeverOption(t *testing.T) {
  source := "JSON.stringify(1);\nclass A { x: number = 0; }\n"
  want := "JSON.stringify(1)\nclass A { x: number = 0; }\n"
  assertFixSnapshotWithOptions(t, "format/semi", source, `{"prefer":"never"}`, want)
}
