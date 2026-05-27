package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noRedeclare: reject declaring the same binding more than once in the
// same scope. The second declaration silently overwrites the first;
// shadowing the binding in a nested scope is left alone because the
// inner declaration introduces a fresh binding.
// https://eslint.org/docs/latest/rules/no-redeclare
//
// Each visited scope (source file, module block, or block) builds a
// `name -> first node` map by walking only the immediate statement
// list — nested blocks introduce their own scopes and are processed by
// a separate visit. The exception is `var`: it hoists to the nearest
// function-like container, so a function-scope visit also descends
// past inner blocks to pull every nested `var` into the function
// scope. Function overload signatures share the implementation's name
// by design and are skipped, mirroring ESLint's behavior.
type noRedeclare struct{}

func (noRedeclare) Name() string { return "no-redeclare" }
func (noRedeclare) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile, shimast.KindModuleBlock, shimast.KindBlock}
}
func (noRedeclare) Check(ctx *Context, node *shimast.Node) {
  statements := scopeStatements(node)
  if statements == nil {
    return
  }
  isFunctionScope := isFunctionScopeContainer(node)
  seen := map[string]*shimast.Node{}

  report := func(name string, declNode *shimast.Node) {
    if prior, exists := seen[name]; exists {
      _ = prior
      ctx.Report(declNode, "'"+name+"' is already defined.")
      return
    }
    seen[name] = declNode
  }

  // A function-body block inherits its parameters as the outermost
  // bindings of the function scope. Pre-seed the seen map so a later
  // `var` or function declaration with the same name reports.
  if isFunctionScope && node.Kind == shimast.KindBlock && node.Parent != nil && isFunctionLikeKind(node.Parent) {
    for _, name := range parameterBindingNames(node.Parent) {
      if name != "" {
        seen[name] = node.Parent
      }
    }
  }

  // Pass 1: block-scoped declarations from the immediate statement
  // list. `var` statements only contribute here in function-scope
  // containers — inside a plain block they belong to the enclosing
  // function scope and are reported there instead.
  for _, stmt := range statements {
    if stmt == nil {
      continue
    }
    if stmt.Kind == shimast.KindVariableStatement && !isFunctionScope {
      vs := stmt.AsVariableStatement()
      if vs != nil && vs.DeclarationList != nil && shimast.IsVar(vs.DeclarationList) {
        continue
      }
    }
    for _, name := range immediateDeclarationNames(stmt) {
      if name != "" {
        report(name, stmt)
      }
    }
  }

  // Pass 2: var hoisting. Function scopes (source file, module block,
  // function body) also collect every `var` declared in nested blocks
  // up to the next function-like boundary. Top-level `var` statements
  // are already reported in Pass 1, so this pass descends into each
  // statement's children rather than visiting the statement itself.
  if isFunctionScope {
    for _, stmt := range statements {
      if stmt == nil || stmt.Kind == shimast.KindVariableStatement {
        continue
      }
      collectHoistedVarsInto(stmt, func(name string, declNode *shimast.Node) {
        if name != "" {
          report(name, declNode)
        }
      })
    }
  }
}

// scopeStatements returns the direct statement list of a scope-defining
// container (source file, module block, or block). Returns nil for any
// other node kind so the caller can bail without further checks.
func scopeStatements(node *shimast.Node) []*shimast.Node {
  switch node.Kind {
  case shimast.KindSourceFile:
    file := node.AsSourceFile()
    if file != nil && file.Statements != nil {
      return file.Statements.Nodes
    }
  case shimast.KindModuleBlock:
    mb := node.AsModuleBlock()
    if mb != nil && mb.Statements != nil {
      return mb.Statements.Nodes
    }
  case shimast.KindBlock:
    block := node.AsBlock()
    if block != nil && block.Statements != nil {
      return block.Statements.Nodes
    }
  }
  return nil
}

// isFunctionScopeContainer reports whether node is a scope into which
// `var` declarations hoist: the source file, a module block, or a
// block that forms the body of a function-like declaration.
func isFunctionScopeContainer(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindSourceFile, shimast.KindModuleBlock:
    return true
  case shimast.KindBlock:
    return node.Parent != nil && isFunctionLikeKind(node.Parent)
  }
  return false
}

// immediateDeclarationNames returns every binding name introduced by a
// single top-level statement of a scope. Variable statements contribute
// their identifier names regardless of `var`/`let`/`const` keyword;
// function and class declarations contribute their own name. Overload
// signatures (`function f(): void;` with no body) are skipped because
// they intentionally repeat the implementation's name. Ambient
// declarations (`declare var x: …`, `declare function f(): …`) are
// also skipped — TypeScript merges them with concrete declarations of
// the same name by design.
func immediateDeclarationNames(stmt *shimast.Node) []string {
  if stmt == nil {
    return nil
  }
  if stmt.ModifierFlags()&shimast.ModifierFlagsAmbient != 0 {
    return nil
  }
  switch stmt.Kind {
  case shimast.KindVariableStatement:
    return variableStatementBindingNames(stmt)
  case shimast.KindFunctionDeclaration:
    decl := stmt.AsFunctionDeclaration()
    if decl == nil || decl.Body == nil {
      return nil
    }
    if name := identifierText(decl.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindClassDeclaration:
    decl := stmt.AsClassDeclaration()
    if decl == nil {
      return nil
    }
    if name := identifierText(decl.Name()); name != "" {
      return []string{name}
    }
  }
  return nil
}

// variableStatementBindingNames returns the identifier name of every
// declaration in a `var`/`let`/`const` statement. Destructuring
// patterns (`const { a } = obj`) are skipped — the rule cannot reason
// about pattern equality without scope resolution, so the conservative
// baseline only handles plain identifier bindings.
func variableStatementBindingNames(stmt *shimast.Node) []string {
  vs := stmt.AsVariableStatement()
  if vs == nil || vs.DeclarationList == nil {
    return nil
  }
  list := vs.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return nil
  }
  var names []string
  for _, decl := range list.Declarations.Nodes {
    if decl == nil {
      continue
    }
    v := decl.AsVariableDeclaration()
    if v == nil {
      continue
    }
    if name := identifierText(v.Name()); name != "" {
      names = append(names, name)
    }
  }
  return names
}

// parameterBindingNames returns the identifier name of every plain
// parameter on a function-like node. Destructured parameters are
// skipped for the same reason as variableStatementBindingNames.
func parameterBindingNames(fn *shimast.Node) []string {
  params := fn.Parameters()
  if len(params) == 0 {
    return nil
  }
  var names []string
  for _, param := range params {
    if param == nil {
      continue
    }
    decl := param.AsParameterDeclaration()
    if decl == nil {
      continue
    }
    if name := identifierText(decl.Name()); name != "" {
      names = append(names, name)
    }
  }
  return names
}

// collectHoistedVarsInto walks every descendant of node up to (but
// not into) a nested function-like boundary, invoking yield for each
// `var` binding it discovers. Both `var` statements and `for (var i …)`
// declaration lists contribute; the former carries a VariableStatement
// kind so the surrounding statement reports, the latter carries a bare
// VariableDeclarationList so each individual VariableDeclaration node
// reports. Plain identifier bindings only — destructuring patterns are
// skipped to keep the rule reliable.
func collectHoistedVarsInto(node *shimast.Node, yield func(string, *shimast.Node)) {
  if node == nil || isFunctionLikeKind(node) {
    return
  }
  if node.Kind == shimast.KindVariableStatement {
    vs := node.AsVariableStatement()
    if vs != nil && vs.DeclarationList != nil && shimast.IsVar(vs.DeclarationList) {
      for _, name := range variableStatementBindingNames(node) {
        yield(name, node)
      }
    }
    return
  }
  if node.Kind == shimast.KindVariableDeclarationList {
    list := node.AsVariableDeclarationList()
    if list != nil && shimast.IsVar(node) && list.Declarations != nil {
      for _, decl := range list.Declarations.Nodes {
        if decl == nil {
          continue
        }
        v := decl.AsVariableDeclaration()
        if v == nil {
          continue
        }
        if name := identifierText(v.Name()); name != "" {
          yield(name, decl)
        }
      }
    }
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    collectHoistedVarsInto(child, yield)
    return false
  })
}

func init() {
  Register(noRedeclare{})
}
