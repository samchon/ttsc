package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noVar: ban `var` declarations. ESLint canonical:
// https://eslint.org/docs/latest/rules/no-var
type noVar struct{}

func (noVar) Name() string           { return "no-var" }
func (noVar) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }
func (noVar) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsVariableStatement()
  if stmt == nil || stmt.DeclarationList == nil {
    return
  }
  if ctx.File != nil && ctx.File.IsDeclarationFile {
    return
  }
  if node.ModifierFlags()&shimast.ModifierFlagsAmbient != 0 {
    return
  }
  if shimast.IsVar(stmt.DeclarationList) {
    const message = "Unexpected var, use let or const instead."
    start := keywordStart(ctx.File, stmt.DeclarationList, "var")
    if start >= 0 && isNoVarAutoFixSafe(ctx, node) {
      ctx.ReportRangeFix(
        start,
        start+len("var"),
        message,
        TextEdit{Pos: start, End: start + len("var"), Text: "let"},
      )
      return
    }
    ctx.Report(node, message)
  }
}

// isNoVarAutoFixSafe reports whether rewriting a `var` statement's keyword to
// `let` is safe using only AST-local information (no scope/data-flow engine).
// It mirrors the conservative posture of isEqeqeqAutoFixSafe: over-declining
// is fine, corrupting source is not. Blindly turning every `var` into `let`
// breaks two real shapes that `var` hoisting tolerates but `let` does not:
//   - redeclaration (`var x=1; var x=2;`) → two `let x` is a SyntaxError;
//   - use-before-declaration (a binding referenced above its own line) →
//     `let` makes that reference a TDZ ReferenceError.
//
// The gate therefore declines when any of these hold:
//   - the declaration list binds more than one name (keep the surface small);
//   - a declared name is referenced anywhere in the file before the
//     statement's Pos() (TDZ / use-before-declaration);
//   - a declared name appears in more than one `var` declaration in the file
//     (redeclaration approximation).
//
// Destructuring patterns contribute no plain identifier names through
// variableStatementBindingNames; such a list yields zero names and is declined
// by the multi-binding / empty check below.
func isNoVarAutoFixSafe(ctx *Context, node *shimast.Node) bool {
  if ctx == nil || ctx.File == nil {
    return false
  }
  names := variableStatementBindingNames(node)
  if len(names) != 1 {
    return false
  }
  declared := map[string]struct{}{}
  for _, name := range names {
    declared[name] = struct{}{}
  }

  declPos := node.Pos()
  varOccurrences := map[string]int{}
  referencedBefore := false
  root := ctx.File.AsNode()
  walkDescendants(root, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindVariableStatement:
      vs := child.AsVariableStatement()
      if vs == nil || vs.DeclarationList == nil || !shimast.IsVar(vs.DeclarationList) {
        return
      }
      for _, name := range variableStatementBindingNames(child) {
        if _, ok := declared[name]; ok {
          varOccurrences[name]++
        }
      }
    case shimast.KindIdentifier:
      name := identifierText(child)
      if name == "" {
        return
      }
      if _, ok := declared[name]; !ok {
        return
      }
      if child.Pos() < declPos {
        referencedBefore = true
      }
    }
  })
  if referencedBefore {
    return false
  }
  for _, count := range varOccurrences {
    if count > 1 {
      return false
    }
  }
  return true
}

// preferConst: flag `let` declarations whose binding is never reassigned.
// This follows ESLint's core rule for the common AST-local cases. It is
// intentionally conservative: destructuring and declaration-only `let`
// variables (those without an initializer and not in a for-of/for-in
// header) are skipped until the lint host grows full scope/data-flow state.
// ESLint canonical: https://eslint.org/docs/latest/rules/prefer-const
type preferConst struct{}

func (preferConst) Name() string           { return "prefer-const" }
func (preferConst) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (preferConst) Check(ctx *Context, node *shimast.Node) {
  type candidate struct {
    name     string
    node     *shimast.Node
    listNode *shimast.Node
  }
  var candidates []candidate
  assigned := map[string]bool{}

  walkDescendants(node, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindVariableDeclaration:
      decl := child.AsVariableDeclaration()
      if decl == nil || child.Parent == nil || child.Parent.Kind != shimast.KindVariableDeclarationList {
        return
      }
      listNode := child.Parent
      if !shimast.IsLet(listNode) {
        return
      }
      name := identifierText(decl.Name())
      if name == "" {
        return
      }
      if !isConstEligibleLetDeclaration(child, decl) {
        return
      }
      candidates = append(candidates, candidate{name: name, node: child, listNode: listNode})
    case shimast.KindBinaryExpression:
      expr := child.AsBinaryExpression()
      if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
        return
      }
      for _, name := range assignmentTargetNames(expr.Left) {
        assigned[name] = true
      }
    case shimast.KindPrefixUnaryExpression:
      expr := child.AsPrefixUnaryExpression()
      if expr == nil {
        return
      }
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        if name := identifierText(expr.Operand); name != "" {
          assigned[name] = true
        }
      }
    case shimast.KindPostfixUnaryExpression:
      expr := child.AsPostfixUnaryExpression()
      if expr == nil {
        return
      }
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        if name := identifierText(expr.Operand); name != "" {
          assigned[name] = true
        }
      }
    }
  })

  for _, c := range candidates {
    if !assigned[c.name] {
      start := -1
      if isSingleDeclarationList(c.listNode) {
        start = keywordStart(ctx.File, c.listNode, "let")
      }
      if start >= 0 {
        ctx.ReportFix(
          c.node,
          "Use const instead of let.",
          TextEdit{Pos: start, End: start + len("let"), Text: "const"},
        )
      } else {
        ctx.Report(c.node, "Use const instead of let.")
      }
    }
  }
}

// isSingleDeclarationList reports whether the VariableDeclarationList node
// declares exactly one binding, which is required before the `let` keyword
// can safely be rewritten to `const` (a multi-binding list shares a single
// keyword, so replacing just one binding's keyword is not valid).
func isSingleDeclarationList(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  list := node.AsVariableDeclarationList()
  return list != nil && list.Declarations != nil && len(list.Declarations.Nodes) == 1
}

// isConstEligibleLetDeclaration reports whether a `let` VariableDeclaration
// node is eligible for preferConst analysis. A declaration is eligible when:
//   - it has an initializer (the value is set immediately), or
//   - it is the loop variable of a for-in or for-of statement (e.g. `for (let k of m)`).
//
// For-statement initializers (`for (let i = 0; …)`) are eligible only when
// the declaration list is a single binding; the loop index is a well-known
// reassignment target so multi-binding for-statement lists are excluded.
func isConstEligibleLetDeclaration(node *shimast.Node, decl *shimast.VariableDeclaration) bool {
  if decl.Initializer != nil {
    if node.Parent != nil && node.Parent.Parent != nil && node.Parent.Parent.Kind == shimast.KindForStatement {
      list := node.Parent.AsVariableDeclarationList()
      return list == nil || list.Declarations == nil || len(list.Declarations.Nodes) == 1
    }
    return true
  }
  return node.Parent != nil && node.Parent.Parent != nil &&
    (node.Parent.Parent.Kind == shimast.KindForInStatement || node.Parent.Parent.Kind == shimast.KindForOfStatement)
}

// noUndefInit: forbid `let x = undefined` and `var x = undefined`.
// ESLint canonical: https://eslint.org/docs/latest/rules/no-undef-init
type noUndefInit struct{}

func (noUndefInit) Name() string           { return "no-undef-init" }
func (noUndefInit) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableDeclaration} }
func (noUndefInit) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Initializer == nil {
    return
  }
  if identifierText(decl.Initializer) == "undefined" {
    ctx.Report(decl.Initializer, "It's not necessary to initialize \"undefined\".")
  }
}

func init() {
  Register(noVar{})
  Register(preferConst{})
  Register(noUndefInit{})
}
