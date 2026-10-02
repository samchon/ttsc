package linthost

import "testing"

// TestASTSelectorExpressionClassExcludesTypeLiterals verifies that the
// `:expression` class selects value literals and no type-level literal.
//
// TypeScript-Go spells a type literal `TypeLiteral` and an object value
// `ObjectLiteralExpression`; a class matcher keyed on the name suffix would
// admit both, so `{ a: string }` in a type position would be reported by a
// `no-restricted-syntax` selector such as `:expression` that means values only.
//
// 1. Parse a source holding one object-literal value and one type literal.
// 2. Select `TypeLiteral:expression` and `ObjectLiteralExpression:expression`.
// 3. Assert the first selects nothing and the second selects the value.
//
// @evidence contracts/testing.md#behavioral-verification parseASTSelector and matchASTSelector run over a parsed source, and the assertions distinguish a type literal from an object value under the same class.
// @evidence contracts/testing.md#independent-expectations ESTree has no expression node for type syntax, so the type literal count of zero and the single object value follow from the grammar rather than from the matcher.
// @evidence contracts/testing.md#distinguishing-cases The same `:expression` class is applied to a type literal (must not match) and to an object literal value (must match, once).
// @evidence contracts/testing.md#execution-ownership The test calls the selector parser and matcher directly on one parsed virtual file in one Go process, with no Program or binary.
func TestASTSelectorExpressionClassExcludesTypeLiterals(t *testing.T) {
  file := parseTS(t, "type T = { a: string };\nconst v = { a: 'x' };\n")
  count := func(source string) int {
    selector, err := parseASTSelector(source)
    if err != nil {
      t.Fatalf("parseASTSelector(%q): %v", source, err)
    }
    return len(matchASTSelector(file.AsNode(), selector))
  }
  if got := count("TypeLiteral:expression"); got != 0 {
    t.Fatalf("TypeLiteral:expression matched %d nodes, want 0", got)
  }
  if got := count("ObjectLiteralExpression:expression"); got != 1 {
    t.Fatalf("ObjectLiteralExpression:expression matched %d nodes, want 1", got)
  }
}
