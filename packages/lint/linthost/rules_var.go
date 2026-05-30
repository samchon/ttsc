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
  // variableStatementBindingNames skips destructuring bindings, so a mixed
  // list like `var a = 1, { b } = o;` yields a single plain name (`a`) and
  // slips the single-binding guard above — yet the one `var` keyword also
  // governs the destructured sibling `{ b }`, which the redeclaration and
  // use-before-declaration scans below never see (they too skip destructuring).
  // Rewriting the keyword to `let` would then corrupt: a later `var b` becomes
  // a duplicate-`let` SyntaxError, and a forward read of `b` becomes a TDZ
  // ReferenceError. Require exactly one VariableDeclaration node in the list so
  // any destructured sibling forces a decline. (`var a=1, b=2` is already
  // declined by the plain-name count; this closes the destructure-sibling gap.)
  if list := node.AsVariableStatement().DeclarationList.AsVariableDeclarationList(); list == nil ||
    list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
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
  countVarListNames := func(listNode *shimast.Node) {
    if listNode == nil || listNode.Kind != shimast.KindVariableDeclarationList || !shimast.IsVar(listNode) {
      return
    }
    list := listNode.AsVariableDeclarationList()
    if list == nil || list.Declarations == nil {
      return
    }
    for _, decl := range list.Declarations.Nodes {
      v := decl.AsVariableDeclaration()
      if v == nil {
        continue
      }
      if name := identifierText(v.Name()); name != "" {
        if _, ok := declared[name]; ok {
          varOccurrences[name]++
        }
      }
    }
  }
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
    case shimast.KindForStatement:
      // A `for`-header `var` is a bare VariableDeclarationList, not a
      // VariableStatement, so the case above never sees it. Count its
      // bindings too, or `var x; for (var x …)` would slip the
      // redeclaration check and corrupt to a duplicate `let`.
      if fs := child.AsForStatement(); fs != nil {
        countVarListNames(fs.Initializer)
      }
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      if fs := child.AsForInOrOfStatement(); fs != nil {
        countVarListNames(fs.Initializer)
      }
    case shimast.KindFunctionDeclaration:
      // A hoisted function declaration may legally share a name with a
      // function-scoped `var` (`var x=1; function x(){}`), but `let x`
      // alongside `function x` is a duplicate-declaration SyntaxError.
      // Count a same-name function declaration as another occurrence so
      // the redeclaration gate below declines the rewrite.
      if fn := child.AsFunctionDeclaration(); fn != nil {
        if name := identifierText(fn.Name()); name != "" {
          if _, ok := declared[name]; ok {
            varOccurrences[name]++
          }
        }
      }
    case shimast.KindClassDeclaration:
      // Same as the function-declaration case: a same-name class
      // declaration alongside `let` is a duplicate-declaration error.
      if cl := child.AsClassDeclaration(); cl != nil {
        if name := identifierText(cl.Name()); name != "" {
          if _, ok := declared[name]; ok {
            varOccurrences[name]++
          }
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
      // Only genuine value references trigger the TDZ / use-before
      // decline. Non-reference occurrences of the same text — a
      // member name (`o.x`), an object-literal key (`{x:1}`), a
      // statement label (`x:`), or a type reference (`: x`) — bind no
      // value and must not force a decline.
      if !isValueReferenceIdentifier(child) {
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

// isValueReferenceIdentifier reports whether an Identifier node occupies a
// value-reference position rather than a non-reference role that merely
// reuses the same text. The use-before-declaration gate in
// isNoVarAutoFixSafe matches identifiers by text alone, so it would
// otherwise decline on positions that bind no value:
//
//   - the `name` of a property access (`o.x`) or qualified name (`A.x`);
//   - an object-literal property key (`{ x: 1 }`) or shorthand key;
//   - a statement label (`x:` / `break x`);
//   - a type reference (`: x`) whose `TypeName` is the identifier.
//
// Classification is by the identifier's parent node kind and slot, never
// by text. Any unrecognized parent is treated as a value reference
// (safety first: an unclassified position keeps declining).
func isValueReferenceIdentifier(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return true
  }
  switch parent.Kind {
  case shimast.KindPropertyAccessExpression:
    // `o.x`: only the object expression is a reference; the member name
    // is a property, not a binding.
    access := parent.AsPropertyAccessExpression()
    return access == nil || access.Name() != node
  case shimast.KindQualifiedName:
    // `A.x` in type position: the right side is a property name.
    qn := parent.AsQualifiedName()
    return qn == nil || qn.Right != node
  case shimast.KindPropertyAssignment:
    // `{ x: target }`: the key is not a reference; the value is.
    assign := parent.AsPropertyAssignment()
    return assign == nil || assign.Name() != node
  // `{ x }`: an object-literal shorthand is a VALUE READ of binding `x`
  // (object destructuring parses as KindBindingElement and is handled
  // elsewhere). It falls through to the default `true` so the
  // use-before-declaration gate sees the forward reference and declines.
  case shimast.KindLabeledStatement:
    // `x:` label — a statement label shares no namespace with values.
    lbl := parent.AsLabeledStatement()
    return lbl == nil || lbl.Label != node
  case shimast.KindBreakStatement:
    brk := parent.AsBreakStatement()
    return brk == nil || brk.Label != node
  case shimast.KindContinueStatement:
    cont := parent.AsContinueStatement()
    return cont == nil || cont.Label != node
  case shimast.KindTypeReference:
    // `: x` — a type reference lives in the type namespace.
    ref := parent.AsTypeReferenceNode()
    return ref == nil || ref.TypeName != node
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
    case shimast.KindForOfStatement, shimast.KindForInStatement:
      // `for (x of …)` / `for (x in …)` reassigns the existing binding `x`
      // on every iteration. When the initializer IS a
      // VariableDeclarationList (`for (const y of …)`) it declares a fresh
      // binding instead, so only a non-declaration initializer counts as a
      // reassignment target. Missing this lets a pre-existing `let` be
      // rewritten to `const` that the loop then assigns to — a TS error and
      // runtime TypeError.
      stmt := child.AsForInOrOfStatement()
      if stmt == nil || stmt.Initializer == nil {
        return
      }
      if stmt.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      for _, name := range assignmentTargetNames(stmt.Initializer) {
        assigned[name] = true
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
