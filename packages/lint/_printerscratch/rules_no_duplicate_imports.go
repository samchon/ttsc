// noDuplicateImports reports an import (and, with `includeExports`, a
// re-export) declaration whose module specifier already appeared above,
// but only when the two declarations could be consolidated into one
// legal declaration. Same-module declarations TypeScript cannot merge —
// named next to namespace bindings, or (since ESLint 9.30.1) a
// type-only default next to type-only named bindings — are not
// duplicates, and `allowSeparateTypeImports` additionally keeps one
// clause-level `import type` declaration apart from value-bearing
// declarations.
// https://eslint.org/docs/latest/rules/no-duplicate-imports
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noDuplicateImportsOptions mirrors the official rule's options object.
// Both keys default to false, matching ESLint's `defaultOptions`.
type noDuplicateImportsOptions struct {
  // AllowSeparateTypeImports keeps clause-level `import type` / `export
  // type` declarations out of the duplicate comparison with
  // value-bearing declarations of the same module. Inline type
  // specifiers (`import { type Foo }`) stay on the value side because
  // their import clause is not type-only.
  AllowSeparateTypeImports bool `json:"allowSeparateTypeImports"`

  // IncludeExports folds `export … from` declarations into the same
  // duplicate/mergeability analysis, adding the official
  // duplicated-as-export / duplicated-as-import pairings.
  IncludeExports bool `json:"includeExports"`
}

// importExportCategory mirrors the specifier categories the official
// implementation derives from ESTree specifier types
// (`getImportExportType`).
type importExportCategory int

const (
  // `import def from "m"` — ImportDefaultSpecifier.
  importExportDefault importExportCategory = iota
  // `import { a } from "m"` / `export { a } from "m"` —
  // ImportSpecifier / ExportSpecifier.
  importExportNamed
  // `import * as ns from "m"` / `export * as ns from "m"` —
  // ImportNamespaceSpecifier / ExportNamespaceSpecifier.
  importExportNamespace
  // `export * from "m"` — ExportAllDeclaration without an alias.
  importExportAll
  // `import "m"` and specifier-less clauses such as `import {} from
  // "m"` / `export {} from "m"` — SideEffectImport.
  importExportSideEffect
)

// importExportEntry retains the shape of one earlier import/re-export
// declaration so later declarations of the same module can answer the
// mergeability question against it.
type importExportEntry struct {
  node     *shimast.Node
  category importExportCategory
  typeOnly bool
  isExport bool
}

type noDuplicateImports struct{ optionsRule }

func (noDuplicateImports) Name() string { return "no-duplicate-imports" }
func (noDuplicateImports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (noDuplicateImports) Check(ctx *Context, node *shimast.Node) {
  var opts noDuplicateImportsOptions
  _ = ctx.DecodeOptions(&opts)
  modules := map[string][]importExportEntry{}
  node.ForEachChild(func(child *shimast.Node) bool {
    if child == nil {
      return false
    }
    switch child.Kind {
    case shimast.KindImportDeclaration:
      decl := child.AsImportDeclaration()
      if decl == nil {
        return false
      }
      module := duplicateImportsModule(decl.ModuleSpecifier)
      if module == "" {
        return false
      }
      entry := duplicateImportsImportEntry(child, decl)
      reportDuplicateImports(ctx, opts, modules[module], entry, module)
      modules[module] = append(modules[module], entry)
    case shimast.KindExportDeclaration:
      // Without `includeExports` the official rule does not even
      // record re-exports, so they can neither be reported nor make
      // a later import count as duplicated-as-export.
      if !opts.IncludeExports {
        return false
      }
      decl := child.AsExportDeclaration()
      if decl == nil {
        return false
      }
      module := duplicateImportsModule(decl.ModuleSpecifier)
      if module == "" {
        return false
      }
      entry := duplicateImportsExportEntry(child, decl)
      reportDuplicateImports(ctx, opts, modules[module], entry, module)
      modules[module] = append(modules[module], entry)
    }
    return false
  })
}

// duplicateImportsModule returns the trimmed module specifier text, or
// "" when the declaration has no usable string specifier (`export { x
// }` without `from`, an empty string module). Trimming mirrors the
// official implementation, which compares `source.value.trim()`.
func duplicateImportsModule(spec *shimast.Node) string {
  return strings.TrimSpace(stringLiteralText(spec))
}

// duplicateImportsImportEntry categorizes one `import` declaration the
// way the official rule reads ESTree specifiers: the first named or
// namespace specifier decides the category, a lone default binding is
// the default category, and a clause-less or specifier-less import is a
// side-effect import.
func duplicateImportsImportEntry(node *shimast.Node, decl *shimast.ImportDeclaration) importExportEntry {
  entry := importExportEntry{node: node, category: importExportSideEffect}
  clause := decl.ImportClause
  if clause == nil {
    return entry
  }
  entry.typeOnly = clause.IsTypeOnly()
  clauseData := clause.AsImportClause()
  if clauseData == nil {
    return entry
  }
  if bindings := clauseData.NamedBindings; bindings != nil {
    switch bindings.Kind {
    case shimast.KindNamespaceImport:
      entry.category = importExportNamespace
      return entry
    case shimast.KindNamedImports:
      // `import def, {} from "m"` has no named specifier in ESTree;
      // the empty block falls through to the default binding below.
      if named := bindings.AsNamedImports(); named != nil && named.Elements != nil && len(named.Elements.Nodes) > 0 {
        entry.category = importExportNamed
        return entry
      }
    }
  }
  if clauseData.Name() != nil {
    entry.category = importExportDefault
  }
  return entry
}

// duplicateImportsExportEntry categorizes one `export … from`
// declaration. `export * from` is the export-all category, `export * as
// ns from` is a namespace specifier, non-empty `export { … } from` is
// named, and the degenerate `export {} from "m"` matches the official
// specifier-less SideEffectImport category.
func duplicateImportsExportEntry(node *shimast.Node, decl *shimast.ExportDeclaration) importExportEntry {
  entry := importExportEntry{
    node:     node,
    category: importExportSideEffect,
    typeOnly: decl.IsTypeOnly,
    isExport: true,
  }
  clause := decl.ExportClause
  if clause == nil {
    entry.category = importExportAll
    return entry
  }
  switch clause.Kind {
  case shimast.KindNamespaceExport:
    entry.category = importExportNamespace
  case shimast.KindNamedExports:
    if named := clause.AsNamedExports(); named != nil && named.Elements != nil && len(named.Elements.Nodes) > 0 {
      entry.category = importExportNamed
    }
  }
  return entry
}

// reportDuplicateImports mirrors the official checkAndReport: an import
// is reported once against earlier imports and once more against
// earlier re-exports, a re-export against earlier re-exports and
// earlier imports, each pairing with its own message. Earlier
// re-exports only exist when `includeExports` recorded them.
func reportDuplicateImports(ctx *Context, opts noDuplicateImportsOptions, previous []importExportEntry, entry importExportEntry, module string) {
  if len(previous) == 0 {
    return
  }
  if entry.isExport {
    if duplicateImportsShouldReport(entry, previous, true, opts.AllowSeparateTypeImports) {
      ctx.Report(entry.node, "`"+module+"` export is duplicated.")
    }
    if duplicateImportsShouldReport(entry, previous, false, opts.AllowSeparateTypeImports) {
      ctx.Report(entry.node, "`"+module+"` export is duplicated as import.")
    }
    return
  }
  if duplicateImportsShouldReport(entry, previous, false, opts.AllowSeparateTypeImports) {
    ctx.Report(entry.node, "`"+module+"` import is duplicated.")
  }
  if duplicateImportsShouldReport(entry, previous, true, opts.AllowSeparateTypeImports) {
    ctx.Report(entry.node, "`"+module+"` import is duplicated as export.")
  }
}

// duplicateImportsShouldReport mirrors the official
// shouldReportImportExport: the new declaration is a duplicate when at
// least one earlier declaration of the requested kind could legally
// absorb it. With `allowSeparateTypeImports`, earlier declarations
// whose clause-level type-ness differs from the new declaration's are
// exempt from the comparison.
func duplicateImportsShouldReport(entry importExportEntry, previous []importExportEntry, wantExport bool, allowSeparateTypeImports bool) bool {
  for _, prev := range previous {
    if prev.isExport != wantExport {
      continue
    }
    if allowSeparateTypeImports && entry.typeOnly != prev.typeOnly {
      continue
    }
    if duplicateImportsCanMerge(entry, prev) {
      return true
    }
  }
  return false
}

// duplicateImportsCanMerge mirrors the official
// isImportExportCanBeMerged: two same-module declarations are duplicates
// only when one legal declaration could carry both clauses.
func duplicateImportsCanMerge(a, b importExportEntry) bool {
  // ESLint 9.30.1 correction: a type-only default and type-only named
  // bindings cannot be merged, because `import type Def, { Named }` is
  // not legal TypeScript.
  if a.typeOnly && b.typeOnly {
    if (a.category == importExportDefault && b.category == importExportNamed) ||
      (b.category == importExportDefault && a.category == importExportNamed) {
      return false
    }
  }
  // `export * from` merges only with another export-all or with a bare
  // side-effect import; default, named, and namespace forms all need a
  // different declaration shape.
  if (a.category == importExportAll && b.category != importExportAll && b.category != importExportSideEffect) ||
    (b.category == importExportAll && a.category != importExportAll && a.category != importExportSideEffect) {
    return false
  }
  // A namespace binding and named bindings cannot share one
  // declaration.
  if (a.category == importExportNamespace && b.category == importExportNamed) ||
    (b.category == importExportNamespace && a.category == importExportNamed) {
    return false
  }
  return true
}

func init() {
  Register(noDuplicateImports{})
}
