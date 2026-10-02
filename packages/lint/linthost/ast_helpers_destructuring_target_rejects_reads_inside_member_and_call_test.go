package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestIsDestructuringAssignmentTargetRejectsLiteralsReadInsideOtherExpressions
// verifies that a literal is a destructuring target only through array, object,
// spread, parenthesis and type-assertion ancestors that end at an assignment
// left side or a for-in/of initializer.
//
// A literal nested in a member access, element access or call that is itself the
// left side of an assignment (`foo({a: 1}).x = 2`) is an ordinary expression
// read, and the ancestor walk must not mistake it for a pattern.
//
// 1. Parse one source holding positive patterns and reads under assignment left
// sides.
// 2. Locate each literal by its source text.
// 3. Assert the literal-pattern cases are targets and the read cases are not.
//
// @evidence contracts/testing.md#behavioral-verification isDestructuringAssignmentTarget walks the real parsed ancestors of each literal and the assertions distinguish pattern positions from reads below a member access, element access or call.
// @evidence contracts/testing.md#independent-expectations Each expectation follows from the ECMAScript grammar: only an array or object literal reachable through pattern positions to the left of `=` or a for-in/of head is a pattern; the answers are literal, not derived from the walk.
// @evidence contracts/testing.md#distinguishing-cases Positive cases are a plain, nested and parenthesized pattern and a for-of head; negative cases are a right-hand side, a default value, an element-access key and an object under a call that is assigned through.
// @evidence contracts/testing.md#execution-ownership The test parses virtual sources and calls the helper directly in one Go process, with no Program, checker or binary.
func TestIsDestructuringAssignmentTargetRejectsLiteralsReadInsideOtherExpressions(t *testing.T) {
  cases := []struct {
    name   string
    source string
    kind   shimast.Kind
    text   string
    want   bool
  }{
    {"plain array pattern", "[a] = arr;", shimast.KindArrayLiteralExpression, "[a]", true},
    {"nested object pattern", "({ k: [b] } = obj);", shimast.KindArrayLiteralExpression, "[b]", true},
    {"parenthesized pattern", "([c]) = arr;", shimast.KindArrayLiteralExpression, "[c]", true},
    {"for-of head", "for ([d] of xs);", shimast.KindArrayLiteralExpression, "[d]", true},
    {"right-hand side", "x = [e];", shimast.KindArrayLiteralExpression, "[e]", false},
    {"default value", "[f = {}] = arr;", shimast.KindObjectLiteralExpression, "{}", false},
    {"element access key", "obj[[1]] = 2;", shimast.KindArrayLiteralExpression, "[1]", false},
    {"object under assigned call result", "foo({ a: 1 }).x = 2;", shimast.KindObjectLiteralExpression, "{ a: 1 }", false},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      file := parseTS(t, tc.source)
      var found *shimast.Node
      walkDescendants(file.AsNode(), func(node *shimast.Node) {
        if found == nil && node.Kind == tc.kind && nodeText(file, node) == tc.text {
          found = node
        }
      })
      if found == nil {
        t.Fatalf("no %v node with text %q in %q", tc.kind, tc.text, tc.source)
      }
      if got := isDestructuringAssignmentTarget(found); got != tc.want {
        t.Fatalf("isDestructuringAssignmentTarget(%q in %q) = %v, want %v", tc.text, tc.source, got, tc.want)
      }
    })
  }
}
