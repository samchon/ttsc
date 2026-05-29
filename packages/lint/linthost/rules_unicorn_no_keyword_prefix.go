// unicorn/no-keyword-prefix: identifiers like `newFoo` or `classBar`
// embed a reserved word at the prefix position so the reader has to
// re-parse the identifier each time. The rule discourages the prefix in
// declarations so the codebase converges on names whose first segment
// is not a JavaScript keyword.
//
// AST-only: visit every `Identifier` and fire only on declaration
// positions (parameter, variable, function, class, method, accessor,
// property, binding-element names). Reads of an already-named binding
// are NOT flagged — the diagnostic is anchored on the declaration so
// the rename happens once. Uses the same value-position-gate logic as
// `prefer-global-this`, inverted: this rule needs the identifier to be
// in a *name* slot, not a value-expression slot.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-keyword-prefix.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoKeywordPrefix struct{}

func (unicornNoKeywordPrefix) Name() string { return "unicorn/no-keyword-prefix" }
func (unicornNoKeywordPrefix) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier}
}
func (unicornNoKeywordPrefix) Check(ctx *Context, node *shimast.Node) {
  name := identifierText(node)
  if !hasKeywordPrefix(name) {
    return
  }
  if !isUnicornDeclarationPositionIdentifier(node) {
    return
  }
  ctx.Report(node, "Don't prefix identifiers with a reserved word (`new` / `class`).")
}

// hasKeywordPrefix reports whether `name` starts with `new` or `class`
// followed by an uppercase ASCII letter. The case-sensitive prefix +
// the uppercase next letter together pin the camelCase pattern the rule
// targets (`newFoo`, `classBar`); plain words like `news` or `classic`
// share the prefix bytes but not the camelCase break and are out of
// scope.
func hasKeywordPrefix(name string) bool {
  for _, prefix := range []string{"new", "class"} {
    if len(name) <= len(prefix) {
      continue
    }
    if name[:len(prefix)] != prefix {
      continue
    }
    next := name[len(prefix)]
    if next >= 'A' && next <= 'Z' {
      return true
    }
  }
  return false
}

// isUnicornDeclarationPositionIdentifier reports whether `node` (a bare
// Identifier) appears as a *name* slot of a declaration, i.e. the slot
// reserved by the language for introducing a new binding. Reads,
// property keys on accesses, type references, and labels are filtered
// out so the rule only fires on declarations.
func isUnicornDeclarationPositionIdentifier(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindIdentifier || node.Parent == nil {
    return false
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindVariableDeclaration:
    decl := parent.AsVariableDeclaration()
    return decl != nil && decl.Name() == node
  case shimast.KindBindingElement:
    elem := parent.AsBindingElement()
    return elem != nil && elem.Name() == node
  case shimast.KindParameter:
    param := parent.AsParameterDeclaration()
    return param != nil && param.Name() == node
  case shimast.KindFunctionDeclaration:
    fn := parent.AsFunctionDeclaration()
    return fn != nil && fn.Name() == node
  case shimast.KindFunctionExpression:
    fn := parent.AsFunctionExpression()
    return fn != nil && fn.Name() == node
  case shimast.KindClassDeclaration:
    cls := parent.AsClassDeclaration()
    return cls != nil && cls.Name() == node
  case shimast.KindClassExpression:
    cls := parent.AsClassExpression()
    return cls != nil && cls.Name() == node
  case shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindPropertyDeclaration:
    return true
  }
  return false
}

func init() {
  Register(unicornNoKeywordPrefix{})
}
