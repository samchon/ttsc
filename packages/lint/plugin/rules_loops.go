package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// for-direction: `for (var i = 10; i < 20; i--)` will never terminate.
// https://eslint.org/docs/latest/rules/for-direction
type forDirection struct{}

func (forDirection) Name() string           { return "for-direction" }
func (forDirection) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindForStatement} }
func (forDirection) Check(ctx *Context, node *shimast.Node) {
  loop := node.AsForStatement()
  if loop == nil || loop.Condition == nil || loop.Incrementor == nil {
    return
  }
  cond := loop.Condition
  if cond.Kind != shimast.KindBinaryExpression {
    return
  }
  bin := cond.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil {
    return
  }
  leftName := identifierText(bin.Left)
  rightName := identifierText(bin.Right)
  if leftName == "" && rightName == "" {
    return
  }
  directionFromCondition := 0
  switch bin.OperatorToken.Kind {
  case shimast.KindLessThanToken, shimast.KindLessThanEqualsToken:
    // `i < limit` requires increment
    if leftName != "" {
      directionFromCondition = +1
    } else {
      directionFromCondition = -1
    }
  case shimast.KindGreaterThanToken, shimast.KindGreaterThanEqualsToken:
    if leftName != "" {
      directionFromCondition = -1
    } else {
      directionFromCondition = +1
    }
  default:
    return
  }
  counterName := leftName
  if counterName == "" {
    counterName = rightName
  }
  directionFromIncr := updateDirection(loop.Incrementor, counterName)
  if directionFromIncr == 0 {
    return
  }
  if directionFromIncr*directionFromCondition < 0 {
    ctx.Report(loop.Incrementor, "The update clause in this loop moves the variable in the wrong direction.")
  }
}

func updateDirection(node *shimast.Node, counter string) int {
  if node == nil || counter == "" {
    return 0
  }
  switch node.Kind {
  case shimast.KindPostfixUnaryExpression:
    post := node.AsPostfixUnaryExpression()
    if post == nil || identifierText(post.Operand) != counter {
      return 0
    }
    switch post.Operator {
    case shimast.KindPlusPlusToken:
      return +1
    case shimast.KindMinusMinusToken:
      return -1
    }
  case shimast.KindPrefixUnaryExpression:
    pre := node.AsPrefixUnaryExpression()
    if pre == nil || identifierText(pre.Operand) != counter {
      return 0
    }
    switch pre.Operator {
    case shimast.KindPlusPlusToken:
      return +1
    case shimast.KindMinusMinusToken:
      return -1
    }
  case shimast.KindBinaryExpression:
    bin := node.AsBinaryExpression()
    if bin == nil || bin.OperatorToken == nil {
      return 0
    }
    if identifierText(bin.Left) != counter {
      return 0
    }
    switch bin.OperatorToken.Kind {
    case shimast.KindPlusEqualsToken:
      return +1
    case shimast.KindMinusEqualsToken:
      return -1
    }
  }
  return 0
}

func init() {
  Register(forDirection{})
}
