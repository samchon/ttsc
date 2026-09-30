package linthost

import "testing"

// TestFormatSemiKeepsBracedAndObjectLiteralAccessorsBare verifies the two
// shapes the accessor kinds reach that must never take a terminator.
//
// GetAccessor and SetAccessor spell three different members: a bodiless
// interface accessor (terminated), a class accessor with a body (Prettier
// never follows a braced member with `;`), and an object-literal accessor
// (whose list is comma-separated, so a `;` there is a syntax error). A
// kind-only insert would corrupt the third and diverge on the second, so
// both negatives are pinned against the positive twin in
// format_semi_terminates_broken_interface_members_test.go.
//
//  1. Parse a class accessor with a body and an object-literal accessor,
//     each ending in `}` on its own line.
//  2. Run format/semi with default options.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must offer no terminator for class and object-literal getters carrying bodies, keeping their braced members and the object comma valid.
// @evidence contracts/testing.md#independent-expectations The independent source uses complete getter bodies whose return statements are already terminated; a braced accessor is not a bodiless type signature and the object list requires commas.
// @evidence contracts/testing.md#distinguishing-cases Class-bodied and object-bodied getter negatives complement bodiless interface and ambient-class accessor insertion positives.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsBracedAndObjectLiteralAccessorsBare is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning semicolon rule and observes zero findings in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiKeepsBracedAndObjectLiteralAccessorsBare(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/semi",
    "class Value {\n"+
      "  get first(): string {\n"+
      "    return \"first\";\n"+
      "  }\n"+
      "}\n"+
      "const holder = {\n"+
      "  get first(): string {\n"+
      "    return \"first\";\n"+
      "  },\n"+
      "};\n",
  )
}
