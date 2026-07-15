// noElseReturn: an `else` block whose preceding `if` branch ends in a
// `return` is redundant — control already left the function on that
// branch, so the `else` body can be flattened into the surrounding
// scope for one less level of nesting and one less branch to read.
// https://eslint.org/docs/latest/rules/no-else-return
//
// This is an AST-only port of the ESLint rule, faithful to its
// analysis:
//
//   - Only `return` terminates a branch (`checkForReturn`). `throw`,
//     `break`, and `continue` do NOT count — matching upstream, which
//     leaves those shapes alone.
//   - `allowElseIf` (default `true`) walks the `if / else if` chain and
//     bails when it ends without a plain `else`, so the very common
//     `return` + `else if` early-return chain stays valid. Set it to
//     `false` to also flag an `else if`.
//   - Analysis starts only at an `if` that sits directly in a statement
//     list (source file, block, class static block, or switch clause),
//     mirroring upstream's `STATEMENT_LIST_PARENTS` gate. A nested
//     `else if` is reached through its chain head's walk, so the rule
//     reports exactly ONCE — on the chain's terminal `else`.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const noElseReturnMessage = "Remove the `else` — the preceding `if` branch already returns."

type noElseReturn struct{ optionsRule }

// noElseReturnOptions mirrors ESLint's single object option. `AllowElseIf`
// is a pointer so a missing option decodes to the upstream default (`true`)
// rather than Go's zero value (`false`).
type noElseReturnOptions struct {
  AllowElseIf *bool `json:"allowElseIf"`
}

func (noElseReturn) Name() string { return "no-else-return" }
func (noElseReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIfStatement}
}

func (noElseReturn) Check(ctx *Context, node *shimast.Node) {
  if node == nil || node.AsIfStatement() == nil {
    return
  }
  // Only analyze a chain head: an `if` whose parent is a statement list.
  // A nested `else if` (parent is the outer `if`) is folded into its head's
  // walk, and a bare loop/label body `if` is left alone — both match
  // upstream's STATEMENT_LIST_PARENTS gate.
  if !noElseReturnStatementListParent(node.Parent) {
    return
  }

  allowElseIf := true
  var opts noElseReturnOptions
  _ = ctx.DecodeOptions(&opts)
  if opts.AllowElseIf != nil {
    allowElseIf = *opts.AllowElseIf
  }

  if allowElseIf {
    noElseReturnCheckWithoutElse(ctx, node)
  } else {
    noElseReturnCheckWithElse(ctx, node)
  }
}

// noElseReturnCheckWithoutElse ports upstream `checkIfWithoutElse`
// (`allowElseIf: true`). Starting at the chain head `node`, it walks the
// `if / else if` chain; if the chain ends without a plain `else` it bails,
// otherwise it reports once on the terminal `else` when every consequent
// always returns.
func noElseReturnCheckWithoutElse(ctx *Context, node *shimast.Node) {
  consequents := make([]*shimast.Node, 0)
  var alternate *shimast.Node
  for current := node; current != nil && current.Kind == shimast.KindIfStatement; {
    ifStmt := current.AsIfStatement()
    if ifStmt == nil || ifStmt.ElseStatement == nil {
      return
    }
    consequents = append(consequents, ifStmt.ThenStatement)
    alternate = ifStmt.ElseStatement
    current = ifStmt.ElseStatement
  }
  for _, consequent := range consequents {
    if !noElseReturnAlwaysReturns(consequent) {
      return
    }
  }
  ctx.Report(alternate, noElseReturnMessage)
}

// noElseReturnCheckWithElse ports upstream `checkIfWithElse`
// (`allowElseIf: false`): a single `if` with an `else` (which may itself be
// an `else if`) reports when its consequent always returns.
func noElseReturnCheckWithElse(ctx *Context, node *shimast.Node) {
  ifStmt := node.AsIfStatement()
  if ifStmt == nil || ifStmt.ElseStatement == nil {
    return
  }
  if noElseReturnAlwaysReturns(ifStmt.ThenStatement) {
    ctx.Report(ifStmt.ElseStatement, noElseReturnMessage)
  }
}

// noElseReturnAlwaysReturns ports upstream `alwaysReturns`: a block returns
// when ANY of its statements returns (or is an `if/else` that returns on both
// paths); a non-block returns when it is itself such a statement.
func noElseReturnAlwaysReturns(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindBlock {
    block := node.AsBlock()
    if block == nil || block.Statements == nil {
      return false
    }
    for _, stmt := range block.Statements.Nodes {
      if noElseReturnCheckForReturnOrIf(stmt) {
        return true
      }
    }
    return false
  }
  return noElseReturnCheckForReturnOrIf(node)
}

// noElseReturnCheckForReturnOrIf ports upstream `checkForReturnOrIf`.
func noElseReturnCheckForReturnOrIf(node *shimast.Node) bool {
  return noElseReturnCheckForReturn(node) || noElseReturnCheckForIf(node)
}

// noElseReturnCheckForReturn ports upstream `checkForReturn`: the terminator
// is a `return`, and only a `return`.
func noElseReturnCheckForReturn(node *shimast.Node) bool {
  return node != nil && node.Kind == shimast.KindReturnStatement
}

// noElseReturnCheckForIf ports upstream `checkForIf`: an `if` with an `else`
// whose then AND else branches each naively return (chained early returns).
func noElseReturnCheckForIf(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindIfStatement {
    return false
  }
  ifStmt := node.AsIfStatement()
  if ifStmt == nil || ifStmt.ThenStatement == nil || ifStmt.ElseStatement == nil {
    return false
  }
  return noElseReturnNaiveHasReturn(ifStmt.ElseStatement) &&
    noElseReturnNaiveHasReturn(ifStmt.ThenStatement)
}

// noElseReturnNaiveHasReturn ports upstream `naiveHasReturn`: a block returns
// when its LAST statement is a `return`; a non-block returns when it is itself
// a `return`.
func noElseReturnNaiveHasReturn(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if node.Kind == shimast.KindBlock {
    block := node.AsBlock()
    if block == nil || block.Statements == nil || len(block.Statements.Nodes) == 0 {
      return false
    }
    stmts := block.Statements.Nodes
    return noElseReturnCheckForReturn(stmts[len(stmts)-1])
  }
  return noElseReturnCheckForReturn(node)
}

// noElseReturnStatementListParent reports whether `parent` is a node whose
// body is a statement list, the TypeScript-AST equivalents of upstream's
// STATEMENT_LIST_PARENTS (Program, BlockStatement, StaticBlock, SwitchCase).
func noElseReturnStatementListParent(parent *shimast.Node) bool {
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindSourceFile,
    shimast.KindBlock,
    shimast.KindClassStaticBlockDeclaration,
    shimast.KindCaseClause,
    shimast.KindDefaultClause:
    return true
  }
  return false
}

func init() {
  Register(noElseReturn{})
}
