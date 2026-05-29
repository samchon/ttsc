// unicorn/no-named-default: a named-import specifier that re-aliases the
// module's default export (`import { default as Foo } from "mod"`) does
// the same job as the dedicated default-import form `import Foo from "mod"`
// but obscures the intent — reviewers reading the named-import list have
// to notice the `default as` prefix to realize the binding is the
// module's default, not a named export named "default". The rule flags
// every such specifier so authors use the default-import syntax instead.
//
// AST-only: dispatch on `KindImportDeclaration`, descend through the
// import clause's NamedImports list, and fire on each specifier whose
// `PropertyName` is an identifier named "default". The default-import
// case (`clause.Name()`) and namespace imports (`* as`) are not
// affected; the property-name check matches both `import { default as X }`
// and the deprecated string form `import { "default" as X }`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-named-default.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNamedDefault struct{}

func (unicornNoNamedDefault) Name() string { return "unicorn/no-named-default" }
func (unicornNoNamedDefault) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindImportDeclaration}
}
func (unicornNoNamedDefault) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsImportDeclaration()
  if decl == nil || decl.ImportClause == nil {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil || clause.NamedBindings == nil ||
    clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return
  }
  for _, spec := range named.Elements.Nodes {
    s := spec.AsImportSpecifier()
    if s == nil || s.PropertyName == nil {
      continue
    }
    if moduleExportNameText(s.PropertyName) != "default" {
      continue
    }
    ctx.Report(spec, "Don't import a default export under a named alias — use `import X from \"...\"` instead.")
  }
}

func init() {
  Register(unicornNoNamedDefault{})
}
