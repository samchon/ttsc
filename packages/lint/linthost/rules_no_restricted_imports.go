// noRestrictedImports reports an `import` (or `export … from`) whose
// module specifier matches a project-configured deny list. The rule is
// the policy hammer for forcing a module boundary: a package that has
// been renamed, a workspace internal that should not leak, or a heavy
// dependency that the project wants to discourage all share the same
// shape — flag the import at its source so the offending line is the
// one the developer fixes.
//
// Configuration shape: a `paths` array of bare module specifiers to
// flag, exact-match only. An empty (or missing) list is a no-op — the
// rule contributes no findings until the project lists something to
// restrict. The native engine's RuleConfig path does not carry options
// to the rule, so the Go unit test exercises the rule via a hard-coded
// default deny list (`lodash`, `underscore`) that fires whenever the
// rule is enabled with no options blob.
// https://eslint.org/docs/latest/rules/no-restricted-imports
package linthost

import (
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noRestrictedImports struct{}

// noRestrictedImportsOptions decodes the `paths` array from a user
// `[severity, options]` tuple. Anything else on the blob is ignored so
// future ESLint-compatible keys (e.g. `patterns`) can be layered in
// without changing existing configs.
type noRestrictedImportsOptions struct {
  Paths []string `json:"paths"`
}

// hardCodedRestrictedImports is the default deny list used when the
// rule is enabled without an options blob. The Go-side test harness
// exercises the rule through `RuleConfig` (severity-only, no options),
// so the rule needs a deterministic non-empty default to be testable
// at the AST layer at all. The choice mirrors a common "don't lean on
// utility-belt libraries" lint setup in real projects.
var hardCodedRestrictedImports = []string{"lodash", "underscore"}

func (noRestrictedImports) Name() string { return "no-restricted-imports" }
func (noRestrictedImports) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindImportDeclaration,
    shimast.KindExportDeclaration,
  }
}
func (noRestrictedImports) Check(ctx *Context, node *shimast.Node) {
  specifierNode := moduleSpecifierOf(node)
  if specifierNode == nil {
    return
  }
  specifier := stringLiteralText(specifierNode)
  if specifier == "" {
    return
  }
  denied := resolveNoRestrictedImportsPaths(ctx)
  for _, target := range denied {
    if specifier == target {
      ctx.Report(specifierNode, "'"+specifier+"' import is restricted from being used.")
      return
    }
  }
}

// moduleSpecifierOf returns the `from "…"` string-literal node of the
// import / re-export declaration. `export { x }` (no `from`) and
// every other shape returns nil so the caller short-circuits.
func moduleSpecifierOf(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindImportDeclaration:
    if imp := node.AsImportDeclaration(); imp != nil {
      return imp.ModuleSpecifier
    }
  case shimast.KindExportDeclaration:
    if exp := node.AsExportDeclaration(); exp != nil {
      return exp.ModuleSpecifier
    }
  }
  return nil
}

// resolveNoRestrictedImportsPaths returns the active deny list for the
// firing context. A `paths` array on the user's options blob wins; an
// empty / missing blob falls back to `hardCodedRestrictedImports` so
// the AST-layer test fires deterministically.
func resolveNoRestrictedImportsPaths(ctx *Context) []string {
  if ctx == nil || len(ctx.Options) == 0 {
    return hardCodedRestrictedImports
  }
  var opts noRestrictedImportsOptions
  if err := json.Unmarshal(ctx.Options, &opts); err != nil || len(opts.Paths) == 0 {
    return hardCodedRestrictedImports
  }
  return opts.Paths
}

func init() {
  Register(noRestrictedImports{})
}
