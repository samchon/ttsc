// unicorn/no-unnecessary-await reports ordinary literal values whose await
// typically only adds a scheduling boundary. Removing await can change task
// ordering even for a primitive. Object/array/RegExp literal classification
// assumes unchanged built-in prototypes; own then or unknown object properties
// and prototype setters are excluded because they can introduce thenables.
//
// AST-only: primitive literals and ordinary array/RegExp literals are reported.
// Object literals require known properties without then, computed names,
// spreads or __proto__. Unknown identifiers and calls are left alone.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-await.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryAwait struct{}

func (unicornNoUnnecessaryAwait) Name() string { return "unicorn/no-unnecessary-await" }
func (unicornNoUnnecessaryAwait) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindAwaitExpression}
}
func (unicornNoUnnecessaryAwait) Check(ctx *Context, node *shimast.Node) {
  await := node.AsAwaitExpression()
  if await == nil || await.Expression == nil {
    return
  }
  operand := stripParens(await.Expression)
  if operand == nil {
    return
  }
  switch operand.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateExpression,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindArrayLiteralExpression:
    ctx.Report(node, "Don't `await` a non-thenable expression.")
  case shimast.KindObjectLiteralExpression:
    if unicornAwaitObjectHasKnownPlainProperties(operand) {
      ctx.Report(node, "Don't `await` a non-thenable expression.")
    }
  }
}

// unicornAwaitObjectHasKnownPlainProperties excludes then, prototype setters,
// spreads and computed names, which can give an object literal thenable behavior.
func unicornAwaitObjectHasKnownPlainProperties(node *shimast.Node) bool {
  object := node.AsObjectLiteralExpression()
  if object == nil || object.Properties == nil {
    return object != nil
  }
  for _, property := range object.Properties.Nodes {
    if property.Kind == shimast.KindSpreadAssignment {
      return false
    }
    name := property.Name()
    if name == nil || name.Kind == shimast.KindComputedPropertyName {
      return false
    }
    text := identifierText(name)
    if name.Kind == shimast.KindStringLiteral {
      text = stringLiteralText(name)
    }
    if text == "then" || text == "__proto__" {
      return false
    }
  }
  return true
}

func init() {
  Register(unicornNoUnnecessaryAwait{})
}
