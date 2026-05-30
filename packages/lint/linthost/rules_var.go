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
// Five corruption holes were patched piecemeal here before (var-vs-var,
// for-header var, function/class redeclaration, mixed destructuring sibling,
// object-literal shorthand, use-before-declaration). That whack-a-mole is
// replaced by one conservative rule with two preconditions; the fix is
// emitted only if BOTH hold:
//
//  1. Single binding in the whole file. The declared name is introduced by
//     EXACTLY ONE binding position anywhere in the source — counting every
//     binding-introducing slot of that identifier: variable declarations and
//     destructuring leaves, function/class/enum/module declarations,
//     parameters and catch bindings, and import bindings. More than one such
//     position → decline. This single count subsumes every prior
//     redeclaration arm (var-vs-var, var-vs-param, var-vs-function, mixed
//     destructure siblings, for-header var, …). It over-declines harmless
//     cross-scope same-name bindings, which never corrupts.
//  2. No use-before-declaration / TDZ. The declared name is not referenced as
//     a VALUE before the statement's Pos(). A non-reference occurrence of the
//     same text — a member name (`o.x`), an object-literal key (`{x:1}`), a
//     statement label (`x:`), or a type reference (`: x`) — binds no value and
//     must not force a decline; isValueReferenceIdentifier classifies these.
//
// The var statement being fixed must itself be a single plain identifier
// declarator so the keyword rewrite has a simple `let x` rename target; a
// destructuring var (`var {a}=o`) or a multi-binding list is declined here
// even though its names might each bind only once.
func isNoVarAutoFixSafe(ctx *Context, node *shimast.Node) bool {
  if ctx == nil || ctx.File == nil {
    return false
  }
  // Precondition: the var being fixed is a single plain identifier declarator.
  // variableStatementBindingNames returns plain identifier names only, so a
  // destructuring declarator yields zero names; requiring exactly one name AND
  // exactly one VariableDeclaration node rejects both multi-binding lists and
  // any destructured (or destructured-sibling) declarator.
  names := variableStatementBindingNames(node)
  if len(names) != 1 {
    return false
  }
  if list := node.AsVariableStatement().DeclarationList.AsVariableDeclarationList(); list == nil ||
    list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
    return false
  }
  target := names[0]

  declPos := node.Pos()
  // The single declarator's initializer subtree. A value reference to `target`
  // inside this range is a self-reference that runs while `target` is still in
  // its temporal dead zone under `let` (`var x = typeof x;`, `var x = x;`,
  // `var x = (() => x)();`), so it must also force a decline even though its
  // Pos() is AFTER the statement's start. initStart/initEnd are -1 when the
  // declarator has no initializer, which disables the range check.
  initStart, initEnd := -1, -1
  if list := node.AsVariableStatement().DeclarationList.AsVariableDeclarationList(); list != nil &&
    list.Declarations != nil && len(list.Declarations.Nodes) == 1 {
    if decl := list.Declarations.Nodes[0].AsVariableDeclaration(); decl != nil && decl.Initializer != nil {
      initStart, initEnd = decl.Initializer.Pos(), decl.Initializer.End()
    }
  }
  bindingCount := 0
  referencedBefore := false
  walkDescendants(ctx.File.AsNode(), func(child *shimast.Node) {
    // Binding count: every position that introduces the name `target` as a
    // binding (a declaration), not a value reference. Two or more positions
    // anywhere in the file decline the fix.
    for _, name := range bindingNamesIntroducedBy(child) {
      if name == target {
        bindingCount++
      }
    }
    // TDZ: a value reference to `target` turns into a ReferenceError under
    // `let` when it executes while `target` is still in its temporal dead
    // zone. Two cases decline:
    //   - a reference BEFORE the var's own position (`log(x); var x = 1;`);
    //   - a self-reference WITHIN the declarator's own initializer range
    //     (`var x = typeof x;`). Conservatively, any value reference inside
    //     the initializer declines — including a deferred read in a nested
    //     closure (`var f = () => f;`) that is actually safe — because the
    //     AST-local gate does not track whether that closure runs during
    //     initialization. Over-declining never corrupts source.
    if child.Kind == shimast.KindIdentifier && identifierText(child) == target &&
      isValueReferenceIdentifier(child) {
      pos := child.Pos()
      if pos < declPos || (initStart >= 0 && pos >= initStart && pos < initEnd) {
        referencedBefore = true
      }
    }
  })
  if referencedBefore {
    return false
  }
  return bindingCount == 1
}

// bindingNamesIntroducedBy returns every plain identifier name that `node`
// introduces as a binding in its OWN slot — never the names bound by its
// descendants, which the file-wide walk visits independently. The classifier
// is by AST kind and slot so a value reference, member name, object-literal
// key, label, or type reference of the same text is excluded; only genuine
// declarations contribute.
//
// A destructuring declarator (`var { a } = o`, `function f([a]) {}`) is NOT
// flattened here: its leaf names belong to the BindingElement descendants,
// which the walk visits on their own, so each leaf is counted exactly once at
// its own position. Declaration nodes therefore contribute only when their
// own name slot is a plain identifier.
//
// Returns nil for any node that introduces no binding in its own slot. Type
// aliases and interfaces are intentionally absent: they live in the type
// namespace and merge with a same-name value binding without a `let`
// duplicate-declaration error.
func bindingNamesIntroducedBy(node *shimast.Node) []string {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    if decl := node.AsVariableDeclaration(); decl != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindParameter:
    if decl := node.AsParameterDeclaration(); decl != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindBindingElement:
    // A leaf of a destructuring pattern (`{ a }`, `[a]`, `{ k: a }`,
    // `...rest`). Only the element's own bound name counts; nested patterns
    // are their own BindingElement descendants, and the default-value
    // initializer is a value reference, not a binding.
    if elem := node.AsBindingElement(); elem != nil {
      if name := identifierText(elem.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindFunctionDeclaration:
    if decl := node.AsFunctionDeclaration(); decl != nil && decl.Body != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindClassDeclaration:
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindEnumDeclaration, shimast.KindModuleDeclaration:
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindCatchClause:
    // `catch (e)` — the catch binding. A destructured catch binding
    // (`catch ({ e })`) has its leaves counted via the BindingElement
    // descendants, so only a plain identifier binding counts here.
    if catch := node.AsCatchClause(); catch != nil && catch.VariableDeclaration != nil {
      if name := identifierText(catch.VariableDeclaration.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindImportClause:
    // `import foo from "m"` — the default import binding. Named and
    // namespace bindings are their own ImportSpecifier / NamespaceImport
    // descendants, visited separately.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindNamespaceImport:
    // `import * as ns from "m"`.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindImportSpecifier:
    // `import { a } from "m"` / `import { a as b } from "m"` — the local
    // binding is the specifier's Name(), not the PropertyName.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindImportEqualsDeclaration:
    // `import x = require("m")` / `import x = A.B`.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  }
  return nil
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
