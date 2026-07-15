package linthost

import "testing"

// TestUnicornNoTypeofUndefinedSkipsUpstreamValidForms verifies the negative
// twin of every reporting surface: the forms upstream lists as valid must
// produce zero findings.
//
// Each guard has a way to over-match. The `typeof` must be the LEFT operand, so
// the reversed `"undefined" === typeof a.b` is skipped; the right side must be a
// string Literal, so a template literal and an identifier are skipped; the value
// must be `"undefined"`, so `"string"` is skipped; the operator must be an
// equality, so `>` is skipped; a non-`typeof` left (`void`, unary `+`, `++`,
// postfix `++`, a bare member) never matches; and a global operand is skipped by
// default because rewriting `typeof window === "undefined"` to `window ===
// undefined` throws a ReferenceError when the global is undeclared. `window`,
// `globalThis`, and an undeclared `foo` cover the resolved-lib-global and
// unresolved-implicit-global branches of that guard.
//
//  1. Enable unicorn/no-typeof-undefined on one source stacking every
//     upstream-valid shape.
//  2. Run the checker-backed snapshot path.
//  3. Assert the rule reports nothing.
func TestUnicornNoTypeofUndefinedSkipsUpstreamValidForms(t *testing.T) {
  source := "declare const a: { b: unknown };\n" +
    "const UNDEFINED = \"undefined\";\n" +
    "\n" +
    "// The `typeof` must be the left operand.\n" +
    "\"undefined\" === typeof a.b;\n" +
    "// A template literal is a TemplateLiteral, never a string Literal.\n" +
    "typeof a.b === `undefined`;\n" +
    "// The right operand is a string, but not \"undefined\".\n" +
    "typeof a.b === \"string\";\n" +
    "// The right operand is an identifier, not a literal.\n" +
    "typeof a.b === UNDEFINED;\n" +
    "// A relational operator is not an equality comparison.\n" +
    "typeof a.b > \"undefined\";\n" +
    "// No `typeof` on the left.\n" +
    "a.b === \"undefined\";\n" +
    "void a.b === \"undefined\";\n" +
    "+a.b === \"undefined\";\n" +
    "++a.b === \"undefined\";\n" +
    "a.b++ === \"undefined\";\n" +
    "foo === undefined;\n" +
    "// A bare `typeof` with no comparison.\n" +
    "typeof a.b;\n" +
    "// Globals are skipped by default: rewriting them can throw.\n" +
    "typeof foo === \"undefined\";\n" +
    "typeof window === \"undefined\";\n" +
    "typeof globalThis === \"undefined\";\n"
  assertRuleSkipsSource(t, "unicorn/no-typeof-undefined", source)
}
