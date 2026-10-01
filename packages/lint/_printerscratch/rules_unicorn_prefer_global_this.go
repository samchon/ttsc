// unicorn/prefer-global-this: `window`, `self`, and `global` are
// environment-specific global aliases. Using them locks code to a
// single runtime (browser, worker, Node) and forces feature-detection
// boilerplate when the same code needs to run elsewhere. `globalThis`
// is the standardized cross-runtime alias and the canonical form for
// the same reference.
//
// AST-only: visit every `Identifier`. The rule fires only when the
// identifier sits in a value-expression position; declaration names,
// property-access right sides, parameter names, property-assignment
// keys, and type references are filtered out by parent-kind gating so
// the diagnostic is anchored on actual reads of the global.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-global-this.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferGlobalThis struct{}

func (unicornPreferGlobalThis) Name() string { return "unicorn/prefer-global-this" }
func (unicornPreferGlobalThis) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier}
}
func (unicornPreferGlobalThis) Check(ctx *Context, node *shimast.Node) {
  name := identifierText(node)
  switch name {
  case "window", "self", "global":
  default:
    return
  }
  if !isUnicornValuePositionIdentifier(node) {
    return
  }
  ctx.Report(node, "Prefer `globalThis` over `window` / `self` / `global`.")
}

// isUnicornValuePositionIdentifier reports whether `node` (a bare
// Identifier) appears in a value-expression position rather than as a
// binding name, property key, member-access right side, or type
// reference. Declaration names and property keys are read positions
// for the *name* itself, so they must not contribute to rules that
// flag *uses* of a global.
func isUnicornValuePositionIdentifier(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindIdentifier || node.Parent == nil {
    return false
  }
  parent := node.Parent
  switch parent.Kind {
  case shimast.KindVariableDeclaration:
    decl := parent.AsVariableDeclaration()
    if decl != nil && decl.Name() == node {
      return false
    }
  case shimast.KindBindingElement:
    elem := parent.AsBindingElement()
    if elem != nil && elem.Name() == node {
      return false
    }
  case shimast.KindParameter:
    param := parent.AsParameterDeclaration()
    if param != nil && param.Name() == node {
      return false
    }
  case shimast.KindFunctionDeclaration:
    fn := parent.AsFunctionDeclaration()
    if fn != nil && fn.Name() == node {
      return false
    }
  case shimast.KindFunctionExpression:
    fn := parent.AsFunctionExpression()
    if fn != nil && fn.Name() == node {
      return false
    }
  case shimast.KindClassDeclaration:
    cls := parent.AsClassDeclaration()
    if cls != nil && cls.Name() == node {
      return false
    }
  case shimast.KindClassExpression:
    cls := parent.AsClassExpression()
    if cls != nil && cls.Name() == node {
      return false
    }
  case shimast.KindPropertyAccessExpression:
    access := parent.AsPropertyAccessExpression()
    if access != nil && access.Name() == node {
      return false
    }
  case shimast.KindPropertyAssignment:
    prop := parent.AsPropertyAssignment()
    if prop != nil && prop.Name() == node {
      return false
    }
  case shimast.KindShorthandPropertyAssignment:
    // `{window}` shorthand — the identifier is both name and read,
    // but the read here is the value position, so allow.
  case shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindPropertyDeclaration:
    // These have a Name() slot that is not a value expression.
    return false
  case shimast.KindTypeReference,
    shimast.KindQualifiedName,
    shimast.KindImportSpecifier,
    shimast.KindExportSpecifier,
    shimast.KindNamespaceImport,
    shimast.KindImportClause,
    shimast.KindNamespaceExport,
    shimast.KindLabeledStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindJsxAttribute,
    shimast.KindEnumDeclaration,
    shimast.KindEnumMember,
    shimast.KindModuleDeclaration,
    shimast.KindTypeParameter,
    shimast.KindInterfaceDeclaration,
    shimast.KindTypeAliasDeclaration:
    return false
  }
  return true
}

func init() {
  Register(unicornPreferGlobalThis{})
}
