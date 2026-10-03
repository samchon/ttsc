package linthost

import "testing"

// TestASTSelectorExpressionClassExcludesTypeLiterals distinguishes the
// parsed TypeLiteral from the object-value ObjectLiteralExpression.
//
// The authored type alias and variable initializer provide one of each
// node kind. Combining each kind selector with :expression must return
// zero type literals and one object value. This fixture exercises these
// two compound selectors, not every value or type syntax class.
//
// @evidence contracts/testing.md#behavioral-verification parseASTSelector and matchASTSelector run over a parsed source, and the assertions distinguish a type literal from an object value under the same class.
// @evidence contracts/testing.md#independent-expectations The authored type alias denotes type syntax rather than a value, while its separate variable initializer contains one object value; literal zero and one counts do not come from the matcher.
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
