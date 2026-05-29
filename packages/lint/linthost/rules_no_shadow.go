// noShadow reports a binding declaration whose name matches a binding
// already in scope at an outer level. The inner declaration silently
// obscures the outer reference — readers expect `outer` inside the body
// to mean the outer binding, but it now resolves to the inner one. The
// pattern is almost always an accidental rebind during refactoring.
// https://eslint.org/docs/latest/rules/no-shadow
//
// Conservative scope tracking: walk the file once with an explicit
// stack of scope frames. A frame is pushed on every function-like
// node (which contributes its parameter names) and on every Block /
// CatchClause (which contributes its block-scoped `let`, `const`,
// `class`, and `function` declarations). `var` bindings are recorded
// on the nearest enclosing function frame instead — they hoist past
// inner block boundaries.
//
// Only plain identifier bindings are tracked. Destructuring patterns
// (`const { a } = …`, `function f({ x }) {}`) are skipped because the
// rule cannot reason about pattern equality without a real binder, and
// the AST-only baseline prefers false negatives to false positives.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noShadow struct{}

func (noShadow) Name() string           { return "no-shadow" }
func (noShadow) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noShadow) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  // Each frame records the names declared at that lexical level.
  // `isFunction` marks frames that absorb hoisted `var` bindings.
  type frame struct {
    names      map[string]bool
    isFunction bool
  }
  stack := []*frame{{names: map[string]bool{}, isFunction: true}}

  outerHas := func(name string) bool {
    for i := len(stack) - 2; i >= 0; i-- {
      if stack[i].names[name] {
        return true
      }
    }
    return false
  }

  declare := func(name string, declNode *shimast.Node, hoist bool) {
    if name == "" {
      return
    }
    target := stack[len(stack)-1]
    if hoist {
      for i := len(stack) - 1; i >= 0; i-- {
        if stack[i].isFunction {
          target = stack[i]
          break
        }
      }
    }
    if outerHas(name) {
      ctx.Report(declNode, "'"+name+"' is already declared in the upper scope.")
    }
    target.names[name] = true
  }

  var walk func(n *shimast.Node)
  walk = func(n *shimast.Node) {
    if n == nil {
      return
    }
    // Bind a function declaration's name in the enclosing scope
    // before descending into its body. `var`-style hoisting takes
    // the name to the nearest function frame.
    if n.Kind == shimast.KindFunctionDeclaration {
      if decl := n.AsFunctionDeclaration(); decl != nil && decl.Body != nil {
        if name := identifierText(decl.Name()); name != "" {
          declare(name, n, true)
        }
      }
    }
    // Push a frame for every scope-introducing node. Function-like
    // frames also receive their parameter names before descending.
    if isFunctionLikeKind(n) {
      stack = append(stack, &frame{names: map[string]bool{}, isFunction: true})
      for _, name := range parameterBindingNames(n) {
        declare(name, n, false)
      }
      n.ForEachChild(func(child *shimast.Node) bool {
        walk(child)
        return false
      })
      stack = stack[:len(stack)-1]
      return
    }
    switch n.Kind {
    case shimast.KindBlock, shimast.KindCatchClause:
      // Function bodies are blocks too, but the function frame
      // pushed above already represents that scope — skip the
      // extra frame so a parameter and a body-level `let` of the
      // same name still register as a redeclare, not a shadow.
      if n.Kind == shimast.KindBlock && n.Parent != nil && isFunctionLikeKind(n.Parent) {
        n.ForEachChild(func(child *shimast.Node) bool {
          walk(child)
          return false
        })
        return
      }
      stack = append(stack, &frame{names: map[string]bool{}})
      if catch := n.AsCatchClause(); catch != nil && catch.VariableDeclaration != nil {
        if name := identifierText(catch.VariableDeclaration.Name()); name != "" {
          declare(name, catch.VariableDeclaration, false)
        }
      }
      n.ForEachChild(func(child *shimast.Node) bool {
        walk(child)
        return false
      })
      stack = stack[:len(stack)-1]
      return
    case shimast.KindVariableStatement:
      vs := n.AsVariableStatement()
      if vs != nil && vs.DeclarationList != nil {
        hoist := shimast.IsVar(vs.DeclarationList)
        for _, name := range variableStatementBindingNames(n) {
          declare(name, n, hoist)
        }
      }
    case shimast.KindClassDeclaration:
      if decl := n.AsClassDeclaration(); decl != nil {
        if name := identifierText(decl.Name()); name != "" {
          declare(name, n, false)
        }
      }
    }
    n.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(node)
}

func init() {
  Register(noShadow{})
}
