// unicorn/consistent-existence-index-check: `indexOf`, `lastIndexOf`,
// `findIndex`, and `findLastIndex` answer "not found" with the sentinel `-1`,
// so an existence test reads clearest when it compares against that sentinel.
// Upstream targets one shape only — a `const` bound to such a call — and
// rewrites the magnitude comparisons on that binding: `index < 0` becomes
// `index === -1`, while `index >= 0` and `index > -1` become `index !== -1`.
// A bare `arr.indexOf(x) < 0` binds no index variable and is not reported,
// exactly as upstream leaves it alone.
//
// Checker-backed, because the rule is scope analysis rather than syntax.
// Upstream walks the declared variable's eslint-scope references and inspects
// the comparisons among them; the port asks the same question from the other
// end, resolving the compared identifier to its checker binding and inspecting
// that binding's declaration. Both directions enumerate the same
// (const-index-declaration, comparison) pairs, and the binding identity is what
// keeps a shadowing `let index`, a same-named binding in a sibling scope, and a
// parameter named `index` out of the report set.
//
// The reversed orientations (`0 > index`, `-1 < index`) are references whose
// binary-expression parent holds them on the right, which upstream skips, so
// they are not recognized here either.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-existence-index-check.md
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

var unicornConsistentExistenceIndexCheckMethods = map[string]struct{}{
  "indexOf":       {},
  "findIndex":     {},
  "lastIndexOf":   {},
  "findLastIndex": {},
}

// unicornConsistentExistenceIndexCheckReplacement is one rewrite of upstream's
// getReplacement: the operator and right operand to write, paired with the ones
// being replaced. The originals are message data, and the original value also
// decides whether the right operand is edited at all — `index > -1` already
// spells `-1`, so only its operator moves.
type unicornConsistentExistenceIndexCheckReplacement struct {
  operator         string
  value            string
  originalOperator string
  originalValue    string
}

// message renders upstream's message template. `===` is the non-existence
// check ("the element is absent"); `!==` is the existence check.
func (r unicornConsistentExistenceIndexCheckReplacement) message() string {
  existence := "existence"
  if r.operator == "===" {
    existence = "non-existence"
  }
  return fmt.Sprintf(
    "Prefer `%s %s` over `%s %s` to check %s.",
    r.operator,
    r.value,
    r.originalOperator,
    r.originalValue,
    existence,
  )
}

type unicornConsistentExistenceIndexCheck struct{}

func (unicornConsistentExistenceIndexCheck) Name() string {
  return "unicorn/consistent-existence-index-check"
}
func (unicornConsistentExistenceIndexCheck) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}

// The checker supplies binding identity: resolving the compared identifier to
// the `const` it was declared by is exactly the lookup eslint-scope performs
// upstream, and a name-only scan would collude shadowed and unrelated indexes.
func (unicornConsistentExistenceIndexCheck) NeedsTypeChecker() bool { return true }

func (unicornConsistentExistenceIndexCheck) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil || node == nil {
    return
  }
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil || bin.Left == nil || bin.Right == nil {
    return
  }
  // Parentheses are the only wrapper ESTree elides, so `(index) < 0` is a
  // comparison of the binding while `(index as number) < 0` is not.
  left := stripParens(bin.Left)
  if left == nil || left.Kind != shimast.KindIdentifier {
    return
  }
  right := stripParens(bin.Right)
  replacement, ok := unicornConsistentExistenceIndexCheckReplacementFor(
    bin.OperatorToken.Kind,
    right,
  )
  if !ok || !unicornConsistentExistenceIndexCheckIsIndexBinding(ctx, left) {
    return
  }

  text := ctx.File.Text()
  operatorStart := shimscanner.SkipTrivia(text, bin.OperatorToken.Pos())
  edits := []TextEdit{{
    Pos:  operatorStart,
    End:  bin.OperatorToken.End(),
    Text: replacement.operator,
  }}
  if replacement.value != replacement.originalValue {
    edits = append(edits, TextEdit{
      Pos:  shimscanner.SkipTrivia(text, right.Pos()),
      End:  right.End(),
      Text: replacement.value,
    })
  }
  // Upstream narrows the diagnostic to `<operator> <right>` rather than the
  // whole comparison, so the caret lands on the part that has to change.
  ctx.ReportRangeFix(operatorStart, right.End(), replacement.message(), edits...)
}

// unicornConsistentExistenceIndexCheckReplacementFor ports upstream's
// getReplacement. Only these three operator/operand pairs are magnitude
// spellings of the sentinel test; `index <= -1` and the equality forms are not
// recognized upstream and stay untouched here.
func unicornConsistentExistenceIndexCheckReplacementFor(
  operator shimast.Kind,
  right *shimast.Node,
) (unicornConsistentExistenceIndexCheckReplacement, bool) {
  switch operator {
  case shimast.KindLessThanToken:
    if unicornConsistentExistenceIndexCheckIsZero(right) {
      return unicornConsistentExistenceIndexCheckReplacement{
        operator:         "===",
        value:            "-1",
        originalOperator: "<",
        originalValue:    "0",
      }, true
    }
  case shimast.KindGreaterThanToken:
    if unicornConsistentExistenceIndexCheckIsNegativeOne(right) {
      return unicornConsistentExistenceIndexCheckReplacement{
        operator:         "!==",
        value:            "-1",
        originalOperator: ">",
        originalValue:    "-1",
      }, true
    }
  case shimast.KindGreaterThanEqualsToken:
    if unicornConsistentExistenceIndexCheckIsZero(right) {
      return unicornConsistentExistenceIndexCheckReplacement{
        operator:         "!==",
        value:            "-1",
        originalOperator: ">=",
        originalValue:    "0",
      }, true
    }
  }
  return unicornConsistentExistenceIndexCheckReplacement{}, false
}

// unicornConsistentExistenceIndexCheckIsZero mirrors upstream's numeric-value
// test. TypeScript normalizes a numeric literal's text to the JavaScript
// number-to-string form, so `0`, `0.0`, `0x0`, and `0e0` all spell "0" here,
// while `0n` is a BigInt literal and `-0` is a unary expression — neither is a
// numeric-literal zero.
func unicornConsistentExistenceIndexCheckIsZero(node *shimast.Node) bool {
  return node != nil && node.Kind == shimast.KindNumericLiteral &&
    numericLiteralText(node) == "0"
}

// unicornConsistentExistenceIndexCheckIsNegativeOne mirrors upstream's
// isNegativeOne: unary minus applied to the numeric literal one.
func unicornConsistentExistenceIndexCheckIsNegativeOne(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindPrefixUnaryExpression {
    return false
  }
  unary := node.AsPrefixUnaryExpression()
  if unary == nil || unary.Operator != shimast.KindMinusToken {
    return false
  }
  operand := stripParens(unary.Operand)
  return operand != nil && operand.Kind == shimast.KindNumericLiteral &&
    numericLiteralText(operand) == "1"
}

// unicornConsistentExistenceIndexCheckIsIndexBinding reports whether the
// identifier resolves to a `const` declared from an index-returning call — the
// checker equivalent of upstream reaching a comparison through the declared
// variable's references. `let`, `var`, `using`, destructured bindings,
// parameters, imports, and consts initialized from anything else all fail here,
// so their comparisons are left alone.
func unicornConsistentExistenceIndexCheckIsIndexBinding(
  ctx *Context,
  identifier *shimast.Node,
) bool {
  symbol := canonicalValueSymbol(ctx, identifier)
  if symbol == nil || symbol.ValueDeclaration == nil {
    return false
  }
  declaration := symbol.ValueDeclaration
  if declaration.Kind != shimast.KindVariableDeclaration ||
    declaration.Parent == nil ||
    declaration.Parent.Kind != shimast.KindVariableDeclarationList {
    return false
  }
  // `await using` carries the const flag too, so the block-scoped bits are
  // compared as a whole against `const` alone.
  if shimast.GetCombinedNodeFlags(declaration)&shimast.NodeFlagsBlockScoped !=
    shimast.NodeFlagsConst {
    return false
  }
  variable := declaration.AsVariableDeclaration()
  if variable == nil || variable.Initializer == nil {
    return false
  }
  if name := variable.Name(); name == nil || name.Kind != shimast.KindIdentifier {
    return false
  }
  return unicornConsistentExistenceIndexCheckIsIndexCall(stripParens(variable.Initializer))
}

// unicornConsistentExistenceIndexCheckIsIndexCall ports upstream's
// `isMethodCall(init, {methods: [...]})`: a plain call of a non-computed member
// whose property names one of the index-returning methods. The receiver is
// unconstrained — `_.indexOf(…)` counts just as much as `array.indexOf(…)`.
func unicornConsistentExistenceIndexCheckIsIndexCall(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  // An optional chain (`foo?.indexOf(bar)`, `foo.indexOf?.(bar)`, or any `?.`
  // earlier in the same chain) is a ChainExpression upstream, which is not a
  // CallExpression and therefore never matches. Parenthesizing breaks the
  // chain on both sides, so `(foo?.bar).indexOf(baz)` still counts.
  if node.Flags&shimast.NodeFlagsOptionalChain != 0 {
    return false
  }
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  name := access.Name()
  if name == nil || name.Kind != shimast.KindIdentifier {
    return false
  }
  _, ok := unicornConsistentExistenceIndexCheckMethods[identifierText(name)]
  return ok
}

func init() {
  Register(unicornConsistentExistenceIndexCheck{})
}
