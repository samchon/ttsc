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
// guard: it first rejects members with bodies, then checks eligible type
// or class holders. This braced object getter exercises the body exclusion,
// preserving its comma in both directions; it does not isolate the later
// parent-only decision with an unsupported bodiless object accessor.
//
//  1. Parse an object literal holding a braced accessor followed by `,`.
//  2. Run format/semi with default options, then through the fixer with
//     prefer:"never".
//  3. Assert the default direction reports nothing, and that the strip
//     direction removes only the two statement terminators.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must preserve the comma after an object-literal getter in both modes; never removes only its return-statement and outer declaration terminators.
// @evidence contracts/testing.md#independent-expectations The independently authored full never-mode output retains the property-list comma and getter body while dropping the two optional statement semicolons; default no-findings is separately asserted.
// @evidence contracts/testing.md#distinguishing-cases The same object fixture supplies a default unchanged result and a never-mode changed/retained pair, distinguishing object getter punctuation from semicolon-bearing type signatures at the shared accessor AST kind. The braced getter reaches the body exclusion before the eligible-parent check.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsObjectLiteralAccessorSeparatorsUntouched is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
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
