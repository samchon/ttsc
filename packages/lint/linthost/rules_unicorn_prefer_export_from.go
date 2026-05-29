// unicorn/prefer-export-from: when the only purpose of a local import is
// to re-export it under the same name, the canonical shape is the
// `export { X } from "Y"` re-export, which skips the intermediate local
// binding entirely. The split `import { X } from "Y"; export { X };`
// form is longer, allocates a binding that never gets used, and reads
// as if the author meant to consume `X` locally before deciding not to.
//
// AST-only minimum-viable port: visit `SourceFile` and walk top-level
// statements once. Build a map from each unrenamed named-binding of an
// `import { X } from "Y"` declaration to its module specifier text, then
// fire on every later `export { X };` statement (no rename, no
// `from`-clause) whose identifier appears in that map. Default and
// namespace imports, renamed bindings, and re-exports with their own
// `from`-clause are out of scope; the MVP only catches the textbook
// "import then immediately re-export" pair.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-export-from.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferExportFrom struct{}

func (unicornPreferExportFrom) Name() string { return "unicorn/prefer-export-from" }
func (unicornPreferExportFrom) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornPreferExportFrom) Check(ctx *Context, node *shimast.Node) {
  statements := node.Statements()
  if len(statements) == 0 {
    return
  }
  // Map of locally-imported simple binding name → true. Built on a
  // first pass so a re-export earlier in the file does not accidentally
  // match an import declared later; the upstream rule is anchored on
  // "imported above, re-exported below" ordering.
  imported := map[string]bool{}
  for _, stmt := range statements {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      continue
    }
    decl := stmt.AsImportDeclaration()
    if decl == nil || decl.ImportClause == nil {
      continue
    }
    clause := decl.ImportClause.AsImportClause()
    if clause == nil || clause.NamedBindings == nil ||
      clause.NamedBindings.Kind != shimast.KindNamedImports {
      continue
    }
    // A default-bound or namespace-mixed import is out of scope: the
    // MVP only rewrites pure `import { X } from "Y"` pairs.
    if clause.Name() != nil {
      continue
    }
    named := clause.NamedBindings.AsNamedImports()
    if named == nil || named.Elements == nil {
      continue
    }
    for _, spec := range named.Elements.Nodes {
      s := spec.AsImportSpecifier()
      if s == nil {
        continue
      }
      // PropertyName is set only when the specifier is renamed
      // (`import { a as b }`); skip those — `export { b }` would
      // require `export { b as b } from "Y"` which is itself a
      // useless rename.
      if s.PropertyName != nil {
        continue
      }
      name := identifierText(s.Name())
      if name == "" {
        continue
      }
      imported[name] = true
    }
  }
  if len(imported) == 0 {
    return
  }
  for _, stmt := range statements {
    if stmt == nil || stmt.Kind != shimast.KindExportDeclaration {
      continue
    }
    decl := stmt.AsExportDeclaration()
    if decl == nil || decl.ExportClause == nil {
      continue
    }
    // Skip `export { X } from "Y"` — already in the target shape.
    if decl.ModuleSpecifier != nil {
      continue
    }
    if decl.ExportClause.Kind != shimast.KindNamedExports {
      continue
    }
    named := decl.ExportClause.AsNamedExports()
    if named == nil || named.Elements == nil || len(named.Elements.Nodes) == 0 {
      continue
    }
    matched := false
    for _, el := range named.Elements.Nodes {
      spec := el.AsExportSpecifier()
      if spec == nil {
        continue
      }
      // PropertyName != nil means `export { a as b }` — a rename
      // the from-clause rewrite cannot preserve without also
      // touching the import side. Skip.
      if spec.PropertyName != nil {
        continue
      }
      name := identifierText(spec.Name())
      if name == "" {
        continue
      }
      if imported[name] {
        matched = true
        break
      }
    }
    if matched {
      ctx.Report(stmt, "Use `export { X } from \"Y\"` instead of importing then re-exporting.")
    }
  }
}

func init() {
  Register(unicornPreferExportFrom{})
}
