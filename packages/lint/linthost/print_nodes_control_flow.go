package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// printControlFlowStatement renders a loop, `if`, `try`, or `switch` by
// preserving its headers and clause keywords exactly as written while laying
// out the blocks and statements they control.
//
// The preserved gaps keep `format/clause-join` as the owner of header spacing
// and retain comments without minting new `else`, `catch`, or `finally`
// tokens. A multi-line preserved gap taints coverage because its original
// interior columns cannot be re-indented safely.
//
// A BRACELESS body is left alone entirely. Prettier indents it one level past
// the header, which is layout the block-depth model has no frame for, and
// `format/indent` cedes it for exactly that reason (`cededUnderBracelessBody`).
//
// The second return value is the `covered` flag: see PrintNode.
func printControlFlowStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  switch node.Kind {
  case shimast.KindForStatement,
    shimast.KindForOfStatement,
    shimast.KindForInStatement,
    shimast.KindWhileStatement:
    body := singleControlFlowBody(node)
    if body == nil || body.Kind != shimast.KindBlock {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    return printNodeAroundChildren(ctx, node, []*shimast.Node{body})
  case shimast.KindIfStatement:
    children, ok := printableIfChildren(node)
    if !ok {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    return printNodeAroundChildren(ctx, node, children)
  case shimast.KindTryStatement:
    children, ok := printableTryChildren(node)
    if !ok {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    return printNodeAroundChildren(ctx, node, children)
  case shimast.KindSwitchStatement:
    stmt := node.AsSwitchStatement()
    if stmt == nil || stmt.CaseBlock == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    return printNodeAroundChildren(ctx, node, []*shimast.Node{stmt.CaseBlock})
  }
  return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
}

// singleControlFlowBody returns the one statement a loop controls.
func singleControlFlowBody(node *shimast.Node) *shimast.Node {
  switch node.Kind {
  case shimast.KindForStatement:
    if stmt := node.AsForStatement(); stmt != nil {
      return stmt.Statement
    }
  case shimast.KindForOfStatement, shimast.KindForInStatement:
    if stmt := node.AsForInOrOfStatement(); stmt != nil {
      return stmt.Statement
    }
  case shimast.KindWhileStatement:
    if stmt := node.AsWhileStatement(); stmt != nil {
      return stmt.Statement
    }
  }
  return nil
}

// printableIfChildren returns the branches an if-printer may lay out. Every
// concrete branch must be a block; an `else if` is accepted recursively because
// its own printer applies the same invariant. A braceless branch makes the
// whole statement fall back to verbatim rather than formatting only one half.
func printableIfChildren(node *shimast.Node) ([]*shimast.Node, bool) {
  if node == nil {
    return nil, false
  }
  stmt := node.AsIfStatement()
  if stmt == nil || stmt.ThenStatement == nil || stmt.ThenStatement.Kind != shimast.KindBlock {
    return nil, false
  }
  children := []*shimast.Node{stmt.ThenStatement}
  if stmt.ElseStatement == nil {
    return children, true
  }
  if stmt.ElseStatement.Kind == shimast.KindBlock {
    return append(children, stmt.ElseStatement), true
  }
  if stmt.ElseStatement.Kind == shimast.KindIfStatement {
    if _, ok := printableIfChildren(stmt.ElseStatement); ok {
      return append(children, stmt.ElseStatement), true
    }
  }
  return nil, false
}

// printableTryChildren returns the try, catch, and finally blocks in source
// order. The catch declaration stays in the preserved gap before its block.
func printableTryChildren(node *shimast.Node) ([]*shimast.Node, bool) {
  stmt := node.AsTryStatement()
  if stmt == nil || stmt.TryBlock == nil {
    return nil, false
  }
  children := []*shimast.Node{stmt.TryBlock}
  if stmt.CatchClause != nil {
    clause := stmt.CatchClause.AsCatchClause()
    if clause == nil || clause.Block == nil {
      return nil, false
    }
    children = append(children, clause.Block)
  }
  if stmt.FinallyBlock != nil {
    children = append(children, stmt.FinallyBlock)
  }
  return children, true
}

// printNodeAroundChildren preserves the source gaps around selected children
// and dispatches those children through the structured printer. The selected
// ranges must be non-overlapping and in source order.
func printNodeAroundChildren(ctx *PrintContext, node *shimast.Node, children []*shimast.Node) (Doc, bool) {
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  cursor := start
  covered := true
  parts := make([]Doc, 0, len(children)*2+1)
  for _, child := range children {
    if child == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    childStart := shimscanner.SkipTrivia(ctx.Source, child.Pos())
    childEnd := child.End()
    if childStart < cursor || childEnd < childStart || childEnd > end {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    gap := ctx.Source[cursor:childStart]
    covered = covered && !strings.Contains(gap, "\n")
    parts = append(parts, Text(gap))
    childDoc, childCovered := PrintNode(ctx, child)
    covered = covered && childCovered
    parts = append(parts, childDoc)
    cursor = childEnd
  }
  suffix := ctx.Source[cursor:end]
  covered = covered && !strings.Contains(suffix, "\n")
  parts = append(parts, Text(suffix))
  return Concat(parts...), covered
}

// printSwitchCaseBlock renders the braces and clauses of a switch. Clauses are
// indented once beneath the switch; their statements are indented once more.
func printSwitchCaseBlock(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  block := node.AsCaseBlock()
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if block == nil || block.Clauses == nil || start < 0 || end <= start || end > len(ctx.Source) ||
    ctx.Source[start] != '{' || ctx.Source[end-1] != '}' {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
  }
  clauses := block.Clauses.Nodes
  if len(clauses) == 0 {
    return Text("{}"), true
  }
  docs := make([]Doc, 0, len(clauses))
  covered := true
  for _, clause := range clauses {
    if clause == nil {
      return verbatim(ctx, node), false
    }
    doc, childCovered := printSwitchClause(ctx, clause)
    covered = covered && childCovered
    docs = append(docs, doc)
  }
  body := joinPrintedNodes(ctx, clauses, docs)
  return Concat(
    Text("{"),
    Indent(ctx.indentUnit(), Hardline(), body),
    Hardline(),
    Text("}"),
  ), covered
}

// printSwitchClause renders `case` or `default` plus its statement list. A
// block written on the clause header line stays there, matching Prettier's
// `case X: {` layout; ordinary statements begin on the next indented line.
func printSwitchClause(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  clause := node.AsCaseOrDefaultClause()
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if clause == nil || clause.Statements == nil || start < 0 || end < start || end > len(ctx.Source) {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  if listHasInterItemComments(ctx, node) {
    return verbatim(ctx, node), false
  }
  statements := clause.Statements.Nodes
  if len(statements) == 0 {
    source := strings.TrimRight(ctx.Source[start:end], " \t\r\n")
    return Text(source), !strings.Contains(source, "\n")
  }
  if statements[0] == nil {
    return verbatim(ctx, node), false
  }
  firstStart := shimscanner.SkipTrivia(ctx.Source, statements[0].Pos())
  if firstStart < start || firstStart > end {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  header := strings.TrimRight(ctx.Source[start:firstStart], " \t\r\n")
  covered := !strings.Contains(header, "\n")
  docs := make([]Doc, 0, len(statements))
  for _, statement := range statements {
    if statement == nil {
      return verbatim(ctx, node), false
    }
    doc, childCovered := PrintNode(ctx, statement)
    covered = covered && childCovered
    docs = append(docs, doc)
  }
  if statements[0] != nil && statements[0].Kind == shimast.KindBlock &&
    lineStartOffset(ctx.Source, start) == lineStartOffset(ctx.Source, firstStart) {
    parts := []Doc{Text(header), Text(" "), docs[0]}
    if len(statements) > 1 {
      rest := joinPrintedNodes(ctx, statements[1:], docs[1:])
      parts = append(parts, Indent(ctx.indentUnit(), Hardline(), rest))
    }
    return Concat(parts...), covered
  }
  return Concat(
    Text(header),
    Indent(ctx.indentUnit(), Hardline(), joinPrintedNodes(ctx, statements, docs)),
  ), covered
}

// printVariableStatement dispatches every initializer while preserving names,
// type annotations, commas, modifiers, and the terminator verbatim.
func printVariableStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  stmt := node.AsVariableStatement()
  if stmt == nil || stmt.DeclarationList == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  list := stmt.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  children := make([]*shimast.Node, 0, len(list.Declarations.Nodes))
  for _, declaration := range list.Declarations.Nodes {
    if declaration == nil {
      return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
    }
    value := declaration.AsVariableDeclaration()
    if value != nil && value.Initializer != nil {
      children = append(children, value.Initializer)
    }
  }
  if len(children) == 0 {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  return printNodeAroundChildren(ctx, node, children)
}

// printThrowStatement preserves `throw` and its terminator while dispatching
// the thrown expression so a nested callback or literal can reflow.
func printThrowStatement(ctx *PrintContext, node *shimast.Node) (Doc, bool) {
  if node == nil {
    return Doc{}, true
  }
  stmt := node.AsThrowStatement()
  if stmt == nil || stmt.Expression == nil {
    return verbatim(ctx, node), !nodeSpansMultipleLines(ctx, node)
  }
  return printNodeAroundChildren(ctx, node, []*shimast.Node{stmt.Expression})
}

// joinPrintedNodes joins source-ordered nodes with hard lines while retaining
// one author-written blank line. An empty-statement ASI guard remains glued to
// the statement it protects, mirroring printBlock's established behavior.
func joinPrintedNodes(ctx *PrintContext, nodes []*shimast.Node, docs []Doc) Doc {
  parts := make([]Doc, 0, len(docs)*2)
  for i, doc := range docs {
    if i > 0 {
      if nodes[i-1] != nil && nodes[i] != nil &&
        nodes[i-1].Kind == shimast.KindEmptyStatement &&
        !rangeHasNewline(ctx.Source, nodes[i-1].End(), shimscanner.SkipTrivia(ctx.Source, nodes[i].Pos())) {
        parts = append(parts, doc)
        continue
      }
      if nodes[i-1] != nil && nodes[i] != nil && blankLineBetweenStatements(ctx.Source, nodes[i-1].End(), nodes[i].Pos()) {
        parts = append(parts, Literalline())
      }
      parts = append(parts, Hardline())
    }
    parts = append(parts, doc)
  }
  return Concat(parts...)
}
