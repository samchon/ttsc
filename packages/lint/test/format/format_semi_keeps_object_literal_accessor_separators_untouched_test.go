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
// guard, and it decides on the list rather than on the member: only a member
// whose parent is an interface body, a type literal, or a class body takes a
// `;` at all. An object literal is none of those, so its comma is not this
// rule's to touch in either direction.
//
//  1. Parse an object literal holding a braced accessor followed by `,`.
//  2. Run format/semi with default options, then through the fixer with
//     prefer:"never".
//  3. Assert the default direction reports nothing, and that the strip
//     direction removes only the two statement terminators.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must preserve the comma after an object-literal getter in both modes; never removes only its return-statement and outer declaration terminators.
// @evidence contracts/testing.md#independent-expectations The independently authored full never-mode output retains the property-list comma and getter body while dropping the two optional statement semicolons; default no-findings is separately asserted.
// @evidence contracts/testing.md#distinguishing-cases The same object fixture supplies a default unchanged result and a never-mode changed/retained pair, distinguishing list ownership from the shared accessor AST kind.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsObjectLiteralAccessorSeparatorsUntouched is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
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
