package linthost

import "testing"

// TestFormatSemiKeepsObjectLiteralAccessorSeparatorsUntouched verifies the
// `,` after an object literal's accessor is never read as a member
// separator, in either direction.
//
// This is the exclusion that makes the comma half of the rule safe rather
// than the one that breaks it. GetAccessor and SetAccessor spell an object
// literal's member with the same kinds a bodiless interface accessor uses,
// and a braced accessor's body pushes its `}` right up against the list's
// `,`, which is exactly where both directions scan for a separator. Reading
// that comma would rewrite it to a `;` the grammar rejects, or delete it and
// splice two properties together. memberTakesSemicolonTerminator is the
// guard: a member carrying a body, or one whose list is `,`-separated, never
// takes a `;`, so its comma is not this rule's to touch.
//
//  1. Parse an object literal holding a braced accessor followed by `,`.
//  2. Run format/semi with default options, then through the fixer with
//     prefer:"never".
//  3. Assert the default direction reports nothing, and that the strip
//     direction removes only the two statement terminators.
func TestFormatSemiKeepsObjectLiteralAccessorSeparatorsUntouched(t *testing.T) {
  const source = "const holder = {\n" +
    "  get first(): string {\n" +
    "    return \"first\";\n" +
    "  },\n" +
    "};\n"
  assertRuleSkipsSource(t, "format/semi", source)
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    source,
    `{"prefer":"never"}`,
    "const holder = {\n"+
      "  get first(): string {\n"+
      "    return \"first\"\n"+
      "  },\n"+
      "}\n",
  )
}
