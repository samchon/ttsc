// Package main is a mechanical completeness auditor for the typescript-go
// shim (`packages/ttsc/shim/*`).
//
// Background. ttsc re-exports typescript-go's `internal/*` packages through the
// shim so plugin authors (typia, nestia, third-party rules) never touch Go
// internals. A missing re-export is an ttsc bug, not a plugin bug — yet they
// keep being discovered one reactive issue at a time (#217, #218, #220, #221,
// #226, #230). This tool computes the shortfall mechanically instead.
//
// The invariant. The shim should be TRANSITIVELY CLOSED over the operations of
// the types it already exposes. If the shim already aliases an upstream type T,
// then everything a plugin can *reach* starting from T should also be reachable
// through the shim. Four closure rules are checked:
//
//   - ENUM   every exported const whose type is an already-exposed enum type
//     must be re-exported. (This is the `SignatureKindConstruct` class —
//     #230 rule 1. `SignatureKind` is exposed but only `...Call` is, so
//     `...Construct` is a deterministic gap.)
//   - FUNC   every exported package-level func whose params and results are all
//     already-reachable types must be reachable. (A plugin holding those
//     types could call it, but can't.)
//   - ESCAPE every exported named type that appears in the signature of an
//     already-exposed operation but is not itself aliased. (A plugin can
//     obtain the value but cannot name its type.)
//   - PRODUCER every pointer-like compiler object consumed by a public shim
//     operation must be obtainable from an unconditional public return or
//     callback, a method on an obtainable receiver, or an explicit root. A type
//     alias alone only makes the object nameable; it provides no meaningful value.
//
// What it deliberately does NOT find: UNEXPORTED helpers a plugin needs by name
// (e.g. `(*Checker).getMinArgumentCount`, #230 rule 2). Those are invisible to
// closure and must come from the consumer-demand scan. The audit prints the
// unexported method/func pool of exposed types as a triage list so the demand
// side has a bounded candidate set.
//
// Usage. This is its own Go module, so run it from its own directory (or via
// `pnpm --filter ttsc shim:audit [mode]`, which is what CI uses):
//
//  cd packages/ttsc/tools/shim_audit
//  go run . -anchor ../../shim/ast -shim ../../shim           # human report
//  go run . -md     -anchor ../../shim/ast -shim ../../shim   # markdown report
//  go run . -fix    -anchor ../../shim/ast -shim ../../shim   # regenerate enum closure
//  go run . -check  -anchor ../../shim/ast -shim ../../shim   # CI gate
//
// "Reachable" is computed from what the shim source textually references: every
// `inner<pkg>.Symbol` selector and every //go:linkname target name. That set is
// exactly the surface a plugin can name, regardless of how it was exposed
// (alias, wrapper, or linkname).
package main

import (
  "bytes"
  "encoding/json"
  "flag"
  "fmt"
  "go/ast"
  "go/format"
  "go/parser"
  "go/token"
  "go/types"
  "os"
  "path/filepath"
  "regexp"
  "sort"
  "strings"

  "golang.org/x/tools/go/packages"
)

const internalPrefix = "github.com/microsoft/typescript-go/internal/"

// shimDirs maps each shim directory to its upstream internal package suffix.
// Kept explicit (rather than globbed) so a new shim dir is a conscious add.
var shimDirs = map[string]string{
  "ast":              "ast",
  "bundled":          "bundled",
  "checker":          "checker",
  "compiler":         "compiler",
  "core":             "core",
  "diagnosticwriter": "diagnosticwriter",
  "lsp":              "lsp",
  "parser":           "parser",
  "printer":          "printer",
  "scanner":          "scanner",
  "transformers":     "transformers",
  "tsoptions":        "tsoptions",
  "tspath":           "tspath",
  "vfs":              "vfs",
  "vfs/cachedvfs":    "vfs/cachedvfs",
  "vfs/osvfs":        "vfs/osvfs",
}

// reachable holds, per upstream package suffix, the set of upstream symbol names
// the shim makes nameable (selector references + linkname targets).
type reachable map[string]map[string]bool

func (r reachable) has(pkg, name string) bool {
  m := r[pkg]
  return m != nil && m[name]
}
func (r reachable) add(pkg, name string) {
  if r[pkg] == nil {
    r[pkg] = map[string]bool{}
  }
  r[pkg][name] = true
}

// flowType identifies an internal compiler object in the public wrapper flow.
// Package suffixes retain nested shim ownership (for example vfs/osvfs).
type flowType struct {
  pkg  string
  name string
}

// producerSurface records the public shim operations that consume and
// produce pointer-like compiler objects. Values are operation names so a gap
// explains which public wrapper requires the missing producer.
type producerSurface struct {
  consumed map[flowType]map[string]bool
  produced map[flowType]map[string]bool
  methods  []methodFlow
}

// methodFlow keeps method results conditional on an obtainable receiver. A
// public method name alone cannot produce anything when its receiver is itself
// unreachable; flattening method returns into producerSurface.produced would
// let rootless method cycles satisfy the audit.
type methodFlow struct {
  receiver flowType
  consumed map[flowType]map[string]bool
  produced map[flowType]map[string]bool
}

// localFlowDefinition resolves named callback and container contracts declared
// by the shim itself. Alias definitions preserve the surrounding pointer state;
// defined types expose their callable/container underlying shape but are not
// mistaken for the internal named type they were declared from.
type localFlowDefinition struct {
  expression ast.Expr
  aliases    map[string]string
  alias      bool
}

type localFlowVisit struct {
  name        string
  direction   flowDirection
  pointerLike bool
}

func newProducerSurface() producerSurface {
  return producerSurface{
    consumed: map[flowType]map[string]bool{},
    produced: map[flowType]map[string]bool{},
  }
}

func (s producerSurface) add(direction flowDirection, typ flowType, operation string) {
  target := s.consumed
  if direction == flowProduce {
    target = s.produced
  }
  if target[typ] == nil {
    target[typ] = map[string]bool{}
  }
  target[typ][operation] = true
}

type flowDirection uint8

const (
  flowConsume flowDirection = iota
  flowProduce
)

func opposite(direction flowDirection) flowDirection {
  if direction == flowConsume {
    return flowProduce
  }
  return flowConsume
}

// linknameRe captures the trailing symbol name of a go:linkname target like
// `...internal/checker.(*Checker).getMinArgumentCount` or `...checker.foo`.
var linknameRe = regexp.MustCompile(`(?m)^//go:linkname\s+\S+\s+` +
  regexp.QuoteMeta("github.com/microsoft/typescript-go/internal/") +
  `([A-Za-z0-9_/]+)\.(?:\(\*?[A-Za-z0-9_]+\)\.)?([A-Za-z0-9_]+)`)

// scanShimReachable parses every .go file under each shim dir and records the
// upstream symbols it references.
func scanShimReachable(shimRoot string) (reachable, error) {
  r := reachable{}
  fset := token.NewFileSet()
  for dir := range shimDirs {
    paths, _ := filepath.Glob(filepath.Join(shimRoot, dir, "*.go"))
    for _, p := range paths {
      src, err := os.ReadFile(p)
      if err != nil {
        return nil, err
      }
      // linkname directives live in comments, so scan raw text too.
      for _, m := range linknameRe.FindAllStringSubmatch(string(src), -1) {
        r.add(m[1], m[2])
      }
      f, err := parser.ParseFile(fset, p, src, parser.SkipObjectResolution)
      if err != nil {
        return nil, fmt.Errorf("%s: %w", p, err)
      }
      // alias map: local import name -> internal pkg suffix
      alias := map[string]string{}
      for _, imp := range f.Imports {
        path := strings.Trim(imp.Path.Value, `"`)
        if !strings.HasPrefix(path, internalPrefix) {
          continue
        }
        suffix := strings.TrimPrefix(path, internalPrefix)
        name := suffix[strings.LastIndex(suffix, "/")+1:]
        if imp.Name != nil {
          name = imp.Name.Name
        }
        alias[name] = suffix
      }
      ast.Inspect(f, func(n ast.Node) bool {
        sel, ok := n.(*ast.SelectorExpr)
        if !ok {
          return true
        }
        id, ok := sel.X.(*ast.Ident)
        if !ok {
          return true
        }
        if suffix, ok := alias[id.Name]; ok {
          r.add(suffix, sel.Sel.Name)
        }
        return true
      })
    }
  }
  return r, nil
}

// scanShimProducerSurface parses normal shim source and models value flow over
// exported package functions and methods. A pointer to an internal named type is a
// compiler-owned graph object: parameters consume one and results produce one.
// Callback variance is reversed for callback parameters and preserved for
// callback results, so an input callback's arguments count as values produced
// by the shim rather than values the plugin must somehow manufacture.
func scanShimProducerSurface(shimRoot string, inner map[string]*packages.Package) (producerSurface, error) {
  surface := newProducerSurface()
  localTypes := map[string]map[string]localFlowDefinition{}
  sources := map[string]map[string][]byte{}
  for dir, suffix := range shimDirs {
    paths, _ := filepath.Glob(filepath.Join(shimRoot, dir, "*.go"))
    for _, path := range paths {
      if strings.HasSuffix(path, "_test.go") {
        continue
      }
      src, err := os.ReadFile(path)
      if err != nil {
        return producerSurface{}, err
      }
      if sources[suffix] == nil {
        sources[suffix] = map[string][]byte{}
      }
      sources[suffix][path] = src
      imports, err := internalImportAliases(src, path)
      if err != nil {
        return producerSurface{}, err
      }
      for _, importedSuffix := range imports {
        if inner[importedSuffix] == nil {
          return producerSurface{}, fmt.Errorf("%s: internal package %s has no loaded type information", path, importedSuffix)
        }
      }
      definitions, err := scanLocalFlowDefinitions(src, path)
      if err != nil {
        return producerSurface{}, err
      }
      if localTypes[suffix] == nil {
        localTypes[suffix] = map[string]localFlowDefinition{}
      }
      for name, definition := range definitions {
        localTypes[suffix][name] = definition
      }
    }
  }
  for suffix, files := range sources {
    for path, src := range files {
      if err := scanProducerFile(src, path, suffix, localTypes[suffix], inner, surface); err != nil {
        return producerSurface{}, err
      }
    }
  }
  return surface, nil
}

func scanLocalFlowDefinitions(src []byte, filename string) (map[string]localFlowDefinition, error) {
  aliases, err := internalImportAliases(src, filename)
  if err != nil {
    return nil, err
  }
  file, err := parser.ParseFile(token.NewFileSet(), filename, src, parser.SkipObjectResolution)
  if err != nil {
    return nil, fmt.Errorf("%s: %w", filename, err)
  }
  definitions := map[string]localFlowDefinition{}
  for _, decl := range file.Decls {
    gen, ok := decl.(*ast.GenDecl)
    if !ok || gen.Tok != token.TYPE {
      continue
    }
    for _, spec := range gen.Specs {
      typ, ok := spec.(*ast.TypeSpec)
      if !ok {
        continue
      }
      definitions[typ.Name.Name] = localFlowDefinition{
        expression: typ.Type,
        aliases:    aliases,
        alias:      typ.Assign.IsValid(),
      }
    }
  }
  return definitions, nil
}

func internalImportAliases(src []byte, filename string) (map[string]string, error) {
  file, err := parser.ParseFile(token.NewFileSet(), filename, src, parser.SkipObjectResolution)
  if err != nil {
    return nil, fmt.Errorf("%s: %w", filename, err)
  }
  aliases := map[string]string{}
  for _, imp := range file.Imports {
    path := strings.Trim(imp.Path.Value, `"`)
    if !strings.HasPrefix(path, internalPrefix) {
      continue
    }
    importedSuffix := strings.TrimPrefix(path, internalPrefix)
    name := importedSuffix[strings.LastIndex(importedSuffix, "/")+1:]
    if imp.Name != nil {
      name = imp.Name.Name
    }
    aliases[name] = importedSuffix
  }
  return aliases, nil
}

func scanProducerFile(src []byte, filename, suffix string, localTypes map[string]localFlowDefinition, inner map[string]*packages.Package, surface producerSurface) error {
  file, err := parser.ParseFile(token.NewFileSet(), filename, src, parser.SkipObjectResolution)
  if err != nil {
    return fmt.Errorf("%s: %w", filename, err)
  }
  aliases, err := internalImportAliases(src, filename)
  if err != nil {
    return err
  }
  for _, decl := range file.Decls {
    fn, ok := decl.(*ast.FuncDecl)
    if !ok || !ast.IsExported(fn.Name.Name) {
      continue
    }
    operation := suffix + "." + fn.Name.Name
    if fn.Recv != nil && len(fn.Recv.List) > 0 {
      operation = suffix + "." + receiverTypeName(fn.Recv.List[0].Type) + "." + fn.Name.Name
    }
    collectFieldFlow(fn.Type.Params, aliases, localTypes, inner, flowConsume, false, operation, surface)
    collectFieldFlow(fn.Type.Results, aliases, localTypes, inner, flowProduce, false, operation, surface)
  }
  return nil
}

func receiverTypeName(expr ast.Expr) string {
  switch receiver := expr.(type) {
  case *ast.Ident:
    return receiver.Name
  case *ast.StarExpr:
    return receiverTypeName(receiver.X)
  case *ast.IndexExpr:
    return receiverTypeName(receiver.X)
  case *ast.IndexListExpr:
    return receiverTypeName(receiver.X)
  default:
    return "receiver"
  }
}

func collectFieldFlow(fields *ast.FieldList, aliases map[string]string, localTypes map[string]localFlowDefinition, inner map[string]*packages.Package, direction flowDirection, pointerLike bool, operation string, surface producerSurface) {
  collectFieldFlowSeen(fields, aliases, localTypes, inner, direction, pointerLike, operation, surface, map[localFlowVisit]bool{})
}

func collectFieldFlowSeen(fields *ast.FieldList, aliases map[string]string, localTypes map[string]localFlowDefinition, inner map[string]*packages.Package, direction flowDirection, pointerLike bool, operation string, surface producerSurface, seen map[localFlowVisit]bool) {
  if fields == nil {
    return
  }
  for _, field := range fields.List {
    collectTypeFlowSeen(field.Type, aliases, localTypes, inner, direction, pointerLike, operation, surface, seen)
  }
}

func collectTypeFlowSeen(expr ast.Expr, aliases map[string]string, localTypes map[string]localFlowDefinition, inner map[string]*packages.Package, direction flowDirection, pointerLike bool, operation string, surface producerSurface, seen map[localFlowVisit]bool) {
  switch node := expr.(type) {
  case *ast.StarExpr:
    collectTypeFlowSeen(node.X, aliases, localTypes, inner, direction, true, operation, surface, seen)
  case *ast.ArrayType:
    collectTypeFlowSeen(node.Elt, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.Ellipsis:
    collectTypeFlowSeen(node.Elt, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.MapType:
    collectTypeFlowSeen(node.Key, aliases, localTypes, inner, direction, false, operation, surface, seen)
    collectTypeFlowSeen(node.Value, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.ChanType:
    collectTypeFlowSeen(node.Value, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.ParenExpr:
    collectTypeFlowSeen(node.X, aliases, localTypes, inner, direction, pointerLike, operation, surface, seen)
  case *ast.IndexExpr:
    collectTypeFlowSeen(node.X, aliases, localTypes, inner, direction, pointerLike, operation, surface, seen)
    collectTypeFlowSeen(node.Index, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.IndexListExpr:
    collectTypeFlowSeen(node.X, aliases, localTypes, inner, direction, pointerLike, operation, surface, seen)
    for _, index := range node.Indices {
      collectTypeFlowSeen(index, aliases, localTypes, inner, direction, false, operation, surface, seen)
    }
  case *ast.FuncType:
    collectFieldFlowSeen(node.Params, aliases, localTypes, inner, opposite(direction), false, operation, surface, seen)
    collectFieldFlowSeen(node.Results, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.InterfaceType:
    collectFieldFlowSeen(node.Methods, aliases, localTypes, inner, direction, false, operation, surface, seen)
  case *ast.Ident:
    definition, local := localTypes[node.Name]
    if !local {
      return
    }
    visit := localFlowVisit{name: node.Name, direction: direction, pointerLike: pointerLike}
    if seen[visit] {
      return
    }
    seen[visit] = true
    collectTypeFlowSeen(definition.expression, definition.aliases, localTypes, inner, direction, definition.alias && pointerLike, operation, surface, seen)
  case *ast.SelectorExpr:
    qualifier, ok := node.X.(*ast.Ident)
    if !ok || !ast.IsExported(node.Sel.Name) {
      return
    }
    importedSuffix, internal := aliases[qualifier.Name]
    if !internal {
      return
    }
    typ := flowType{pkg: importedSuffix, name: node.Sel.Name}
    if pointerLike {
      surface.add(direction, typ, operation)
    } else if pkg := inner[importedSuffix]; pkg != nil && pkg.Types != nil {
      if typeName, ok := pkg.Types.Scope().Lookup(node.Sel.Name).(*types.TypeName); ok {
        collectGoTypeFlow(typeName.Type(), direction, false, operation, surface)
      }
    }
  }
}

// hasShimSource reports whether dir holds non-test Go source — i.e. an actual
// shim re-export package, not a test-only directory like ast/test (whose only
// *.go are *_test.go and which is not part of the re-export surface).
func hasShimSource(dir string) bool {
  goFiles, _ := filepath.Glob(filepath.Join(dir, "*.go"))
  for _, f := range goFiles {
    if !strings.HasSuffix(f, "_test.go") {
      return true
    }
  }
  return false
}

// checkShimDirCoverage fails if any sub-directory of the shim root (at ANY
// depth) that contains non-test Go source is not registered in shimDirs. This
// keeps the audit's package list honest: a newly-added shim — including a
// NESTED package like vfs/osvfs that a non-recursive, immediate-children scan
// would miss — cannot escape the gate by omission.
func checkShimDirCoverage(shimRoot string) error {
  var unmapped []string
  var walk func(dir, rel string) error
  walk = func(dir, rel string) error {
    entries, err := os.ReadDir(dir)
    if err != nil {
      return err
    }
    for _, e := range entries {
      if !e.IsDir() {
        continue
      }
      childRel := e.Name()
      if rel != "" {
        childRel = rel + "/" + e.Name()
      }
      if _, ok := shimDirs[childRel]; !ok && hasShimSource(filepath.Join(dir, e.Name())) {
        unmapped = append(unmapped, childRel)
      }
      if err := walk(filepath.Join(dir, e.Name()), childRel); err != nil {
        return err
      }
    }
    return nil
  }
  if err := walk(shimRoot, ""); err != nil {
    return err
  }
  if len(unmapped) > 0 {
    sort.Strings(unmapped)
    return fmt.Errorf("shim dir(s) not registered in shimDirs (would escape the audit): %s\n"+
      "  add them to shimDirs in tools/shim_audit/main.go", strings.Join(unmapped, ", "))
  }
  return nil
}

// loadInner loads the upstream internal packages via go/types, anchored in a
// shim module that requires typescript-go (same trick gen_shims uses).
func loadInner(anchorDir string) (map[string]*packages.Package, error) {
  var full []string
  expected := map[string]bool{}
  for _, suffix := range shimDirs {
    full = append(full, internalPrefix+suffix)
    expected[suffix] = true
  }
  loaded, err := packages.Load(&packages.Config{
    Dir:  anchorDir,
    Mode: packages.LoadTypes | packages.NeedDeps | packages.NeedImports,
  }, full...)
  if err != nil {
    return nil, err
  }
  indexed, errored := indexInternalPackages(loaded)
  // A package that fails to load (or is missing entirely) must FAIL the audit,
  // never be silently skipped — otherwise a load error in any environment turns
  // the gate into a no-op that passes blind.
  failures := map[string]string{}
  for suffix := range expected {
    if _, ok := indexed[suffix]; ok {
      continue
    }
    failures[suffix] = errored[suffix]
    if failures[suffix] == "" {
      failures[suffix] = "did not load"
    }
  }
  if len(failures) > 0 {
    failed := make([]string, 0, len(failures))
    for suffix, message := range failures {
      failed = append(failed, suffix+": "+message)
    }
    sort.Strings(failed)
    return nil, fmt.Errorf("%d internal package(s) failed to load (audit would be incomplete):\n  %s",
      len(failed), strings.Join(failed, "\n  "))
  }
  roots := map[string]*packages.Package{}
  for suffix := range expected {
    roots[suffix] = indexed[suffix]
  }
  return roots, nil
}

// indexInternalPackages includes dependency packages because public contracts
// in a registered shim package can name callback/container types declared in an
// unregistered internal dependency. Dropping such a package would make the AST
// producer scan silently stop at the selector.
func indexInternalPackages(roots []*packages.Package) (map[string]*packages.Package, map[string]string) {
  indexed := map[string]*packages.Package{}
  errored := map[string]string{}
  visited := map[*packages.Package]bool{}
  var visit func(*packages.Package)
  visit = func(pkg *packages.Package) {
    if pkg == nil || visited[pkg] {
      return
    }
    visited[pkg] = true
    if strings.HasPrefix(pkg.PkgPath, internalPrefix) {
      suffix := strings.TrimPrefix(pkg.PkgPath, internalPrefix)
      switch {
      case len(pkg.Errors) > 0:
        errored[suffix] = pkg.Errors[0].Error()
      case pkg.Types == nil:
        errored[suffix] = "type information did not load"
      default:
        indexed[suffix] = pkg
      }
    }
    for _, imported := range pkg.Imports {
      visit(imported)
    }
  }
  for _, root := range roots {
    visit(root)
  }
  return indexed, errored
}

// namedInfo returns the defining package suffix and name of a named OR
// alias-to-named type, when it is a typescript-go internal type. Handling
// *types.Alias matters: an enum declared `type PragmaKindFlags = uint8` (a Go
// type alias to a basic) gives its member consts an *types.Alias type, and a
// bare *types.Named assertion would drop them — leaving a partial re-export of
// that #230-class enum invisible to the zero-tolerance ENUM check.
func namedInfo(t types.Type) (pkgSuffix, name string, ok bool) {
  var obj *types.TypeName
  switch n := t.(type) {
  case *types.Named:
    obj = n.Obj()
  case *types.Alias:
    obj = n.Obj()
  default:
    return "", "", false
  }
  if obj.Pkg() == nil {
    return "", "", false
  }
  path := obj.Pkg().Path()
  if !strings.HasPrefix(path, internalPrefix) {
    return "", "", false
  }
  return strings.TrimPrefix(path, internalPrefix), obj.Name(), true
}

// isReachable reports whether a plugin holding only shim-exposed types could
// name/produce a value of type t.
func isReachable(t types.Type, r reachable, seen map[types.Type]bool) bool {
  if seen[t] {
    return true
  }
  seen[t] = true
  switch x := t.(type) {
  case *types.Basic:
    return true
  case *types.Pointer:
    return isReachable(x.Elem(), r, seen)
  case *types.Slice:
    return isReachable(x.Elem(), r, seen)
  case *types.Array:
    return isReachable(x.Elem(), r, seen)
  case *types.Map:
    return isReachable(x.Key(), r, seen) && isReachable(x.Elem(), r, seen)
  case *types.Chan:
    return isReachable(x.Elem(), r, seen)
  case *types.Interface:
    return true // error / empty interface in practice
  case *types.Signature:
    return tupleReachable(x.Params(), r) && tupleReachable(x.Results(), r)
  case *types.TypeParam:
    return false
  case *types.Named:
    o := x.Obj()
    if o.Pkg() == nil {
      return true // builtin error etc.
    }
    path := o.Pkg().Path()
    if strings.HasPrefix(path, internalPrefix) {
      suffix := strings.TrimPrefix(path, internalPrefix)
      if _, shimmed := pkgIsShimmed(suffix); shimmed {
        return r.has(suffix, o.Name())
      }
      return false // internal pkg we do not shim at all
    }
    return o.Exported() // external module type the plugin can import directly
  default:
    return false
  }
}

func tupleReachable(t *types.Tuple, r reachable) bool {
  if t == nil {
    return true
  }
  for i := 0; i < t.Len(); i++ {
    if !isReachable(t.At(i).Type(), r, map[types.Type]bool{}) {
      return false
    }
  }
  return true
}

func pkgIsShimmed(suffix string) (string, bool) {
  for dir, s := range shimDirs {
    if s == suffix {
      return dir, true
    }
  }
  return "", false
}

// commonPrefix returns the longest common string prefix of names ("" if the
// slice is empty or the names share no prefix).
func commonPrefix(names []string) string {
  if len(names) == 0 {
    return ""
  }
  p := names[0]
  for _, n := range names[1:] {
    for !strings.HasPrefix(n, p) {
      p = p[:len(p)-1]
      if p == "" {
        return ""
      }
    }
  }
  return p
}

// attachUntypedConsts groups untyped exported consts into enum families by name.
// go/types reports a bit-reuse const like `ObjectFlagsContainsSpread = 1 << 22`
// as a plain int (no enum type), so its family must be recovered from the name.
// Each enum offers two candidate prefixes: its TYPE NAME, and — when distinct
// and >=3 chars — the common prefix of its already-typed members (the
// abbreviation case: OuterExpressionKinds' members are OEK*, including the
// untyped OEKExcludeJSDocTypeAssertion that carries no OuterExpressionKinds
// prefix). A const joins the family of its LONGEST matching prefix; a match must
// extend the prefix with an uppercase letter (a member-name boundary). Returns
// enum-type-name -> attached const names.
func attachUntypedConsts(enumNames []string, typedMembers map[string][]string, untyped []string) map[string][]string {
  type cand struct{ prefix, enum string }
  var cands []cand
  for _, en := range enumNames {
    cands = append(cands, cand{en, en})
    if lcp := commonPrefix(typedMembers[en]); len(lcp) >= 3 &&
      !strings.HasPrefix(lcp, en) && !strings.HasPrefix(en, lcp) {
      cands = append(cands, cand{lcp, en})
    }
  }
  sort.Slice(cands, func(i, j int) bool {
    if len(cands[i].prefix) != len(cands[j].prefix) {
      return len(cands[i].prefix) > len(cands[j].prefix)
    }
    if cands[i].prefix != cands[j].prefix {
      return cands[i].prefix < cands[j].prefix
    }
    return cands[i].enum < cands[j].enum
  })
  out := map[string][]string{}
  for _, cn := range untyped {
    for _, c := range cands {
      if len(cn) > len(c.prefix) && strings.HasPrefix(cn, c.prefix) &&
        cn[len(c.prefix)] >= 'A' && cn[len(c.prefix)] <= 'Z' {
        out[c.enum] = append(out[c.enum], cn)
        break
      }
    }
  }
  return out
}

// Finding kinds.
type finding struct {
  kind   string // ENUM / FUNC / ESCAPE / PRODUCER
  pkg    string
  symbol string
  detail string
}

func main() {
  md := flag.Bool("md", false, "emit markdown report")
  fix := flag.Bool("fix", false, "write enums_gen.go closing every exposed enum family (Layer 1)")
  check := flag.Bool("check", false, "CI gate: exit non-zero on any TIER-1 enum gap or any TIER-2/3 gap outside the baseline")
  writeBaseline := flag.Bool("write-baseline", false, "(re)generate the baseline of accepted TIER-2/3 gaps")
  baselinePath := flag.String("baseline", "baseline.json", "path to the accepted-gap baseline")
  anchor := flag.String("anchor", "./shim/ast", "module dir anchoring the typescript-go require")
  shimRoot := flag.String("shim", "./shim", "shim root directory")
  flag.Parse()

  // A shim directory that is not registered in shimDirs would silently escape
  // every check — close that hole before doing anything else.
  if err := checkShimDirCoverage(*shimRoot); err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(2)
  }

  r, err := scanShimReachable(*shimRoot)
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  inner, err := loadInner(*anchor)
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  rootPackages := make([]*packages.Package, 0, len(inner))
  for _, pkg := range inner {
    rootPackages = append(rootPackages, pkg)
  }
  typeGraph, _ := indexInternalPackages(rootPackages)
  producerSurface, err := scanShimProducerSurface(*shimRoot, typeGraph)
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }

  findings, pool := analyze(r, inner)
  addExposedMethodFlow(r, inner, &producerSurface)
  producerSurface = canonicalizeProducerSurface(producerSurface, typeGraph)

  switch {
  case *fix:
    runFix(findings, *shimRoot)
  case *writeBaseline:
    runWriteBaseline(findings, *baselinePath)
  case *check:
    runCheck(findings, producerSurface, *baselinePath)
  default:
    producerEvaluation := evaluateProducerSurface(producerSurface, nil)
    report(dedupe(append(findings, producerEvaluation.gaps...)), pool, *md)
  }
}

type producerEvaluation struct {
  gaps      []finding
  usedRoots map[string]bool
}

// evaluateProducerSurface computes the obtainable compiler-object set to a
// fixed point. Package functions and callbacks provide unconditional roots;
// method flows become active only after their receiver is obtainable. Explicit
// baseline roots participate in the same graph, so a reasoned receiver root can
// unlock its real method results without exempting those downstream objects.
func evaluateProducerSurface(surface producerSurface, roots map[string]string) producerEvaluation {
  reachable := map[flowType]bool{}
  for typ := range surface.produced {
    reachable[typ] = true
  }
  allTypes := map[flowType]bool{}
  for typ := range surface.consumed {
    allTypes[typ] = true
  }
  for typ := range surface.produced {
    allTypes[typ] = true
  }
  for _, method := range surface.methods {
    allTypes[method.receiver] = true
    for typ := range method.consumed {
      allTypes[typ] = true
    }
    for typ := range method.produced {
      allTypes[typ] = true
    }
  }
  usedRoots := map[string]bool{}
  for key, rationale := range roots {
    if strings.TrimSpace(rationale) == "" {
      continue
    }
    typ, ok := parseProducerExemptionKey(key)
    if !ok || !allTypes[typ] || reachable[typ] {
      continue
    }
    reachable[typ] = true
    usedRoots[key] = true
  }

  consumed := map[flowType]map[string]bool{}
  mergeFlows := func(target map[flowType]map[string]bool, flows map[flowType]map[string]bool) {
    for typ, operations := range flows {
      if target[typ] == nil {
        target[typ] = map[string]bool{}
      }
      for operation := range operations {
        target[typ][operation] = true
      }
    }
  }
  mergeFlows(consumed, surface.consumed)
  active := make([]bool, len(surface.methods))
  for changed := true; changed; {
    changed = false
    for index, method := range surface.methods {
      if active[index] || !reachable[method.receiver] {
        continue
      }
      active[index] = true
      changed = true
      mergeFlows(consumed, method.consumed)
      for typ := range method.produced {
        if !reachable[typ] {
          reachable[typ] = true
        }
      }
    }
  }

  var findings []finding
  for typ, operations := range consumed {
    if reachable[typ] {
      continue
    }
    names := make([]string, 0, len(operations))
    for operation := range operations {
      names = append(names, operation)
    }
    sort.Strings(names)
    findings = append(findings, finding{
      kind:   "PRODUCER",
      pkg:    typ.pkg,
      symbol: typ.name,
      detail: "consumed by " + strings.Join(names, ", ") + " but no reachable public shim operation produces it",
    })
  }
  return producerEvaluation{gaps: dedupe(findings), usedRoots: usedRoots}
}

func parseProducerExemptionKey(key string) (flowType, bool) {
  separator := strings.LastIndexByte(key, '.')
  if separator <= 0 || separator == len(key)-1 {
    return flowType{}, false
  }
  return flowType{pkg: key[:separator], name: key[separator+1:]}, true
}

func canonicalizeProducerSurface(surface producerSurface, inner map[string]*packages.Package) producerSurface {
  canonical := newProducerSurface()
  copyDirection := func(direction flowDirection, flows map[flowType]map[string]bool) {
    for typ, operations := range flows {
      typ = canonicalFlowType(typ, inner)
      for operation := range operations {
        canonical.add(direction, typ, operation)
      }
    }
  }
  copyDirection(flowConsume, surface.consumed)
  copyDirection(flowProduce, surface.produced)
  for _, method := range surface.methods {
    converted := methodFlow{
      receiver: canonicalFlowType(method.receiver, inner),
      consumed: map[flowType]map[string]bool{},
      produced: map[flowType]map[string]bool{},
    }
    copyMethodDirection := func(target map[flowType]map[string]bool, flows map[flowType]map[string]bool) {
      for typ, operations := range flows {
        typ = canonicalFlowType(typ, inner)
        if target[typ] == nil {
          target[typ] = map[string]bool{}
        }
        for operation := range operations {
          target[typ][operation] = true
        }
      }
    }
    copyMethodDirection(converted.consumed, method.consumed)
    copyMethodDirection(converted.produced, method.produced)
    canonical.methods = append(canonical.methods, converted)
  }
  return canonical
}

func canonicalFlowType(typ flowType, inner map[string]*packages.Package) flowType {
  pkg := inner[typ.pkg]
  if pkg == nil || pkg.Types == nil {
    return typ
  }
  named, ok := pkg.Types.Scope().Lookup(typ.name).(*types.TypeName)
  if !ok {
    return typ
  }
  if pkgSuffix, name, ok := namedInfo(types.Unalias(named.Type())); ok {
    return flowType{pkg: pkgSuffix, name: name}
  }
  return typ
}

// addExposedMethodFlow covers the method set published automatically by each
// exposed type alias. Those methods do not appear as declarations in shim
// source, but their receiver, parameter, callback, and result flows are part of
// the same public surface as hand-written package wrappers.
func addExposedMethodFlow(r reachable, inner map[string]*packages.Package, surface *producerSurface) {
  for suffix, pkg := range inner {
    scope := pkg.Types.Scope()
    for _, name := range scope.Names() {
      typeName, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !r.has(suffix, name) {
        continue
      }
      exposed := types.Unalias(typeName.Type())
      named, ok := exposed.(*types.Named)
      if !ok {
        continue
      }
      receiver := types.Type(named)
      if _, isInterface := named.Underlying().(*types.Interface); !isInterface {
        receiver = types.NewPointer(named)
      }
      methods := types.NewMethodSet(receiver)
      for i := 0; i < methods.Len(); i++ {
        method, ok := methods.At(i).Obj().(*types.Func)
        if !ok || !method.Exported() {
          continue
        }
        signature := method.Signature()
        operation := suffix + "." + name + "." + method.Name()
        methodSurface := newProducerSurface()
        collectGoTupleFlow(signature.Params(), flowConsume, operation, methodSurface)
        collectGoTupleFlow(signature.Results(), flowProduce, operation, methodSurface)
        if len(methodSurface.consumed) == 0 && len(methodSurface.produced) == 0 {
          continue
        }
        // Key the dependency to the exposed outer type, not the declaring
        // receiver of a promoted method: callers need an outer value to invoke
        // the selected method and never manufacture an embedded implementation
        // receiver directly.
        surface.methods = append(surface.methods, methodFlow{
          receiver: flowType{pkg: suffix, name: name},
          consumed: methodSurface.consumed,
          produced: methodSurface.produced,
        })
      }
    }
  }
}

func collectGoTupleFlow(tuple *types.Tuple, direction flowDirection, operation string, surface producerSurface) {
  collectGoTupleFlowSeen(tuple, direction, operation, surface, map[flowVisit]bool{})
}

type flowVisit struct {
  typ         types.Type
  direction   flowDirection
  pointerLike bool
}

func collectGoTupleFlowSeen(tuple *types.Tuple, direction flowDirection, operation string, surface producerSurface, seen map[flowVisit]bool) {
  if tuple == nil {
    return
  }
  for i := 0; i < tuple.Len(); i++ {
    collectGoTypeFlowSeen(tuple.At(i).Type(), direction, false, operation, surface, seen)
  }
}

func collectGoTypeFlow(typ types.Type, direction flowDirection, pointerLike bool, operation string, surface producerSurface) {
  collectGoTypeFlowSeen(typ, direction, pointerLike, operation, surface, map[flowVisit]bool{})
}

func collectGoTypeFlowSeen(typ types.Type, direction flowDirection, pointerLike bool, operation string, surface producerSurface, seen map[flowVisit]bool) {
  visit := flowVisit{typ: typ, direction: direction, pointerLike: pointerLike}
  if seen[visit] {
    return
  }
  seen[visit] = true
  switch current := typ.(type) {
  case *types.Alias:
    collectGoTypeFlowSeen(types.Unalias(current), direction, pointerLike, operation, surface, seen)
  case *types.Pointer:
    collectGoTypeFlowSeen(current.Elem(), direction, true, operation, surface, seen)
  case *types.Slice:
    collectGoTypeFlowSeen(current.Elem(), direction, false, operation, surface, seen)
  case *types.Array:
    collectGoTypeFlowSeen(current.Elem(), direction, false, operation, surface, seen)
  case *types.Map:
    collectGoTypeFlowSeen(current.Key(), direction, false, operation, surface, seen)
    collectGoTypeFlowSeen(current.Elem(), direction, false, operation, surface, seen)
  case *types.Chan:
    collectGoTypeFlowSeen(current.Elem(), direction, false, operation, surface, seen)
  case *types.Signature:
    collectGoTupleFlowSeen(current.Params(), opposite(direction), operation, surface, seen)
    collectGoTupleFlowSeen(current.Results(), direction, operation, surface, seen)
  case *types.Interface:
    current.Complete()
    for i := 0; i < current.NumMethods(); i++ {
      signature, ok := current.Method(i).Type().(*types.Signature)
      if !ok {
        continue
      }
      collectGoTupleFlowSeen(signature.Params(), opposite(direction), operation, surface, seen)
      collectGoTupleFlowSeen(signature.Results(), direction, operation, surface, seen)
    }
  case *types.Named:
    if pointerLike {
      if pkg, name, ok := namedInfo(current); ok {
        surface.add(direction, flowType{pkg: pkg, name: name}, operation)
      }
    }
    if args := current.TypeArgs(); args != nil {
      for i := 0; i < args.Len(); i++ {
        collectGoTypeFlowSeen(args.At(i), direction, false, operation, surface, seen)
      }
    }
    switch underlying := current.Underlying().(type) {
    case *types.Interface, *types.Signature, *types.Slice, *types.Array, *types.Map, *types.Chan, *types.Pointer:
      collectGoTypeFlowSeen(underlying, direction, false, operation, surface, seen)
    }
  }
}

// analyze runs the upstream closure checks plus the unexported demand-pool scan and
// returns the deduped findings and pool.
func analyze(r reachable, inner map[string]*packages.Package) (findings, unexportedPool []finding) {
  for suffix, pkg := range inner {
    scope := pkg.Types.Scope()

    // CHECK 1 (ENUM): consts of an exposed enum type that are not re-exported.
    // Two passes so we also catch family members that upstream declares as
    // UNTYPED ints (e.g. `ObjectFlagsContainsSpread = 1 << 22`, which reuses
    // a bit position and drops the `ObjectFlags` annotation). go/types sees
    // those as plain ints, so a strict type-based grouping silently misses
    // them — a real blind spot the closure check must not have.
    constsByType := map[string][]string{} // "pkg.Type" -> member const names
    typeKey := map[string][2]string{}     // "pkg.Type" -> {pkgSuffix, typeName}

    // Seed a family for every exported named basic (int/string) type in this
    // package, keyed by the TYPE — not by whether any of its consts happens to
    // be typed. This is essential: an enum whose members are ALL untyped (every
    // member `= iota` / `1<<n` with no annotation, e.g. printer's
    // GeneratedIdentifierFlags) would otherwise never register as a family, and
    // a partial re-export of exactly the #230 class would pass the gate.
    var enumNames []string
    for _, name := range scope.Names() {
      tn, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !tn.Exported() {
        continue
      }
      // Underlying() resolves through both *types.Named and *types.Alias, so an
      // enum declared as a basic type alias (`type PragmaKindFlags = uint8`) is
      // seeded as a family just like a defined type — otherwise its untyped
      // members would attach to nothing.
      if _, isBasic := tn.Type().Underlying().(*types.Basic); isBasic {
        enumNames = append(enumNames, name)
      }
    }

    var basicConsts []string // exported consts with an unnamed basic type
    for _, name := range scope.Names() {
      c, ok := scope.Lookup(name).(*types.Const)
      if !ok || !c.Exported() {
        continue
      }
      if ps, tn, ok := namedInfo(c.Type()); ok {
        key := ps + "." + tn
        constsByType[key] = append(constsByType[key], name)
        typeKey[key] = [2]string{ps, tn}
      } else if _, isBasic := c.Type().Underlying().(*types.Basic); isBasic {
        basicConsts = append(basicConsts, name)
      }
    }
    // Attach each untyped const to its enum family by name. attachUntypedConsts
    // matches the longest of each enum's prefixes — the type name, plus the
    // abbreviation prefix shared by its typed members — so untyped+unprefixed
    // members (e.g. OuterExpressionKinds' OEKExcludeJSDocTypeAssertion = 1<<6)
    // are not silently dropped from the #230 enum-closure check.
    typedMembers := make(map[string][]string, len(enumNames))
    for _, en := range enumNames {
      typedMembers[en] = constsByType[suffix+"."+en]
    }
    for en, consts := range attachUntypedConsts(enumNames, typedMembers, basicConsts) {
      key := suffix + "." + en
      constsByType[key] = append(constsByType[key], consts...)
      typeKey[key] = [2]string{suffix, en}
    }
    for key, names := range constsByType {
      tk := typeKey[key]
      if !r.has(tk[0], tk[1]) {
        continue // the enum type itself isn't exposed; not a closure gap
      }
      // Tier by partial exposure: an enum with SOME members already
      // re-exported but not all is the near-certain #230 bug class
      // (e.g. SignatureKindCall present, SignatureKindConstruct absent).
      // An enum with zero members exposed is a deliberate type-only
      // aliasing choice — report it, but at INFO.
      var exposed, missing int
      for _, n := range names {
        if r.has(suffix, n) {
          exposed++
        } else {
          missing++
        }
      }
      kind := "ENUM"
      detail := "member of exposed enum " + tk[1]
      if exposed == 0 {
        kind = "ENUM?"
        detail += " (type-only: NO members exposed — likely intentional)"
      } else {
        detail += fmt.Sprintf(" (PARTIAL: %d/%d members exposed — missing siblings)", exposed, exposed+missing)
      }
      for _, n := range names {
        if !r.has(suffix, n) {
          findings = append(findings, finding{kind, suffix, n, detail})
        }
      }
    }

    // CHECK 2 (FUNC) + CHECK 3 (ESCAPE) over exported package-level funcs.
    for _, name := range scope.Names() {
      obj := scope.Lookup(name)
      fn, ok := obj.(*types.Func)
      if !ok || !fn.Exported() {
        continue
      }
      sig := fn.Signature()
      if sig.Recv() != nil || sig.TypeParams() != nil {
        continue
      }
      if r.has(suffix, name) {
        continue
      }
      // ESCAPE: an exported type in this func's signature that isn't aliased —
      // a plugin could obtain/pass the value but cannot name its type. This must
      // cover free functions, not just methods: `func GetFoo() *UnexposedType`
      // is invisible to the FUNC check (its result isn't reachable) yet leaks an
      // unnameable type.
      for _, esc := range escapingTypes(sig, r) {
        findings = append(findings, finding{"ESCAPE", esc[0], esc[1],
          "appears in exported func " + name + " but is not aliased"})
      }
      // FUNC: every param/result already reachable — usable but not exposed.
      if tupleReachable(sig.Params(), r) && tupleReachable(sig.Results(), r) {
        findings = append(findings, finding{"FUNC", suffix, name,
          "all params/results already reachable — usable but not exposed"})
      }
    }

    // CHECK 3 (ESCAPE) + unexported pool, over the FULL method set of each
    // EXPOSED named type — including methods promoted from embedded types, which
    // named.Method(i) would miss (e.g. printer.NodeFactory embeds ast.NodeFactory).
    for _, name := range scope.Names() {
      tn, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !r.has(suffix, name) {
        continue // only types the shim already exposes
      }
      named, ok := tn.Type().(*types.Named)
      if !ok {
        continue
      }
      mset := types.NewMethodSet(types.NewPointer(named))
      for i := 0; i < mset.Len(); i++ {
        m, ok := mset.At(i).Obj().(*types.Func)
        if !ok {
          continue
        }
        if !m.Exported() {
          if isUsefulUnexported(m, r) {
            unexportedPool = append(unexportedPool, finding{"UNEXPORTED", suffix,
              name + "." + m.Name(), sigString(m.Signature())})
          }
          continue
        }
        // Exported methods of an exposed type are directly callable;
        // the gap is any escaping result/param type that isn't exposed.
        for _, esc := range escapingTypes(m.Signature(), r) {
          findings = append(findings, finding{"ESCAPE", esc[0], esc[1],
            "appears in exposed " + name + "." + m.Name() + " but is not aliased"})
        }
      }
    }
  }

  return dedupe(findings), dedupe(unexportedPool)
}

// escapingTypes returns [pkg,name] of exported internal named types in a
// signature that are not reachable through the shim.
func escapingTypes(sig *types.Signature, r reachable) [][2]string {
  var out [][2]string
  collect := func(t *types.Tuple) {
    if t == nil {
      return
    }
    for i := 0; i < t.Len(); i++ {
      walkNamed(t.At(i).Type(), func(ps, tn string, exported bool) {
        if exported && !r.has(ps, tn) {
          if _, ok := pkgIsShimmed(ps); ok {
            out = append(out, [2]string{ps, tn})
          }
        }
      })
    }
  }
  collect(sig.Params())
  collect(sig.Results())
  return out
}

// walkNamed visits the internal named types syntactically reachable from t and
// calls fn for each, descending pointers, slices, arrays, maps and channels —
// the shapes tsgo's exported signatures actually use. By design (TIER-3 escape
// detection is best-effort, ratcheted by baseline.json — not the airtight enum
// layer) it does NOT descend into struct fields, interface/func element types,
// or a generic Named's type arguments; an escaping type reachable only through
// one of those is left to the baseline.
func walkNamed(t types.Type, fn func(ps, tn string, exported bool)) {
  switch x := t.(type) {
  case *types.Pointer:
    walkNamed(x.Elem(), fn)
  case *types.Slice:
    walkNamed(x.Elem(), fn)
  case *types.Array:
    walkNamed(x.Elem(), fn)
  case *types.Map:
    walkNamed(x.Key(), fn)
    walkNamed(x.Elem(), fn)
  case *types.Chan:
    walkNamed(x.Elem(), fn)
  case *types.Named:
    if ps, tn, ok := namedInfo(x); ok {
      fn(ps, tn, x.Obj().Exported())
    }
  }
}

// isUsefulUnexported keeps unexported methods whose params/results are all
// reachable — i.e. ones a plugin could actually call if linknamed.
func isUsefulUnexported(m *types.Func, r reachable) bool {
  sig := m.Signature()
  if sig.TypeParams() != nil {
    return false
  }
  return tupleReachable(sig.Params(), r) && tupleReachable(sig.Results(), r)
}

func sigString(sig *types.Signature) string {
  return strings.ReplaceAll(types.TypeString(sig, func(p *types.Package) string {
    return p.Name()
  }), "func", "")
}

func dedupe(in []finding) []finding {
  // Keep the lexicographically smallest detail per key so the report text is
  // deterministic when a type is reached through more than one path (map
  // iteration order would otherwise flap the human-readable detail). The
  // gate/baseline key is kind|pkg|symbol only, so this never affects pass/fail.
  idx := map[string]int{}
  var out []finding
  for _, f := range in {
    k := f.kind + "|" + f.pkg + "|" + f.symbol
    if i, ok := idx[k]; ok {
      if f.detail < out[i].detail {
        out[i].detail = f.detail
      }
      continue
    }
    idx[k] = len(out)
    out = append(out, f)
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].pkg != out[j].pkg {
      return out[i].pkg < out[j].pkg
    }
    if out[i].kind != out[j].kind {
      return out[i].kind < out[j].kind
    }
    return out[i].symbol < out[j].symbol
  })
  return out
}

// tierOf maps a finding kind to a confidence tier. Tier 1 is the near-certain
// bug class (#230); higher tiers are progressively noisier candidate pools.
func tierOf(kind string) int {
  switch kind {
  case "ENUM": // partial enum — some members exposed, siblings missing
    return 1
  case "FUNC", "PRODUCER": // callable ops and constructible object flow
    return 2
  case "ESCAPE": // type returned by an exposed op but not aliased
    return 3
  default: // ENUM? type-only enums
    return 4
  }
}

func report(findings, pool []finding, md bool) {
  tiers := map[int][]finding{}
  for _, f := range findings {
    t := tierOf(f.kind)
    tiers[t] = append(tiers[t], f)
  }
  h := func(s string) {
    if md {
      fmt.Printf("\n## %s\n\n", s)
    } else {
      fmt.Printf("\n=== %s ===\n", s)
    }
  }
  row := func(f finding) {
    if md {
      fmt.Printf("| %s | %s | `%s` | %s |\n", f.kind, f.pkg, f.symbol, f.detail)
    } else {
      fmt.Printf("[%-5s] %s.%s — %s\n", f.kind, f.pkg, f.symbol, f.detail)
    }
  }
  thead := func() {
    if md {
      fmt.Printf("| Kind | Pkg | Symbol | Detail |\n|------|-----|--------|--------|\n")
    }
  }

  if md {
    fmt.Printf("# Shim closure audit\n\n")
  } else {
    fmt.Printf("=== Shim closure audit ===\n")
  }
  fmt.Printf("Tier 1 PARTIAL-ENUM (near-certain bugs): %d | Tier 2 FUNC/PRODUCER: %d | Tier 3 ESCAPE: %d | Tier 4 type-only enums: %d | Unexported demand pool: %d\n",
    len(tiers[1]), len(tiers[2]), len(tiers[3]), len(tiers[4]), len(pool))

  h("TIER 1 — partial enums (a sibling const is missing; this is the #230 class)")
  thead()
  for _, f := range tiers[1] {
    row(f)
  }

  h("TIER 2 — reachable funcs and consumed compiler objects without producers")
  thead()
  for _, f := range tiers[2] {
    row(f)
  }

  h("TIER 3 — escaping types (produced by an exposed op but not aliased)")
  thead()
  for _, f := range tiers[3] {
    row(f)
  }

  // Tier 4 (type-only enums) and the unexported pool are large/low-signal:
  // summarize by package rather than dumping every line.
  h("TIER 4 — type-only enums (no members exposed; likely intentional) — counts by pkg")
  fmt.Print(countByPkg(tiers[4]))

  h("UNEXPORTED demand pool (closure-invisible — needs consumer/agent signal) — counts by pkg")
  fmt.Print(countByPkg(pool))
  if !md {
    fmt.Printf("(re-run with a grep, e.g. `| grep '\\.getMin'`, to inspect specific candidates)\n")
  }
}

func countByPkg(in []finding) string {
  c := map[string]int{}
  for _, f := range in {
    c[f.pkg]++
  }
  keys := make([]string, 0, len(c))
  for k := range c {
    keys = append(keys, k)
  }
  sort.Strings(keys)
  var b strings.Builder
  for _, k := range keys {
    fmt.Fprintf(&b, "  %-16s %d\n", k, c[k])
  }
  return b.String()
}

// findingKey is the stable identity of a gap, used for baseline membership.
func findingKey(f finding) string { return f.kind + "|" + f.pkg + "|" + f.symbol }

// baselineFile is the on-disk schema of accepted TIER-2/3 gaps. TIER-1 enum
// gaps are never baselined. Producer gaps require a separate, reasoned root or
// ownership-boundary exemption because accepting an ordinary symbol gap must
// not waive object constructibility.
type baselineFile struct {
  Note               string            `json:"note"`
  Accepted           []string          `json:"accepted"`
  ProducerExemptions map[string]string `json:"producer_exemptions,omitempty"`
}

type baselineEvaluation struct {
  enumGaps       []finding
  newGaps        []finding
  producerGaps   []finding
  invalidReasons []string
  staleAccepted  int
  staleProducers int
}

func evaluateBaseline(findings []finding, baseline baselineFile, usedProducerRoots map[string]bool) baselineEvaluation {
  accepted := map[string]bool{}
  for _, key := range baseline.Accepted {
    accepted[key] = true
  }
  evaluation := baselineEvaluation{}
  liveAccepted := map[string]bool{}
  for _, f := range findings {
    switch f.kind {
    case "ENUM":
      evaluation.enumGaps = append(evaluation.enumGaps, f)
    case "FUNC", "ESCAPE":
      key := findingKey(f)
      liveAccepted[key] = true
      if !accepted[key] {
        evaluation.newGaps = append(evaluation.newGaps, f)
      }
    case "PRODUCER":
      evaluation.producerGaps = append(evaluation.producerGaps, f)
    }
  }
  for key := range accepted {
    if !liveAccepted[key] {
      evaluation.staleAccepted++
    }
  }
  for key, rationale := range baseline.ProducerExemptions {
    if strings.TrimSpace(rationale) == "" {
      evaluation.invalidReasons = append(evaluation.invalidReasons, key)
    }
    if !usedProducerRoots[key] {
      evaluation.staleProducers++
    }
  }
  sort.Strings(evaluation.invalidReasons)
  return evaluation
}

// shimPackageName reads the `package` clause from a .go file in dir.
func shimPackageName(dir string) string {
  paths, _ := filepath.Glob(filepath.Join(dir, "*.go"))
  fset := token.NewFileSet()
  for _, p := range paths {
    if f, err := parser.ParseFile(fset, p, nil, parser.PackageClauseOnly); err == nil {
      return f.Name.Name
    }
  }
  return filepath.Base(dir)
}

// runFix writes shim/<pkg>/enums_gen.go for every package carrying TIER-1 enum
// gaps, re-exporting each missing member so the family is complete. Const
// re-exports carry no behavior and no ABI risk, so closing the whole family is
// always safe — and makes the #230 class structurally impossible.
//
// A member REMOVAL across a typescript-go bump is the one case -fix does not
// auto-heal: a package whose last gap disappears is not rewritten here, so a
// stale enums_gen.go still referencing the removed symbol must be deleted by
// hand (the native build catches the dangling reference).
func runFix(findings []finding, shimRoot string) {
  byPkg := map[string][]string{}
  for _, f := range findings {
    if f.kind == "ENUM" {
      byPkg[f.pkg] = append(byPkg[f.pkg], f.symbol)
    }
  }
  if len(byPkg) == 0 {
    fmt.Println("shim_audit: no enum-family gaps; nothing to fix")
    return
  }
  pkgs := make([]string, 0, len(byPkg))
  for p := range byPkg {
    pkgs = append(pkgs, p)
  }
  sort.Strings(pkgs)
  for _, pkg := range pkgs {
    names := byPkg[pkg]
    sort.Strings(names)
    dir := filepath.Join(shimRoot, pkg)
    pkgName := shimPackageName(dir)
    alias := "inner" + pkgName
    var b strings.Builder
    b.WriteString("// Code generated by packages/ttsc/tools/shim_audit -fix. DO NOT EDIT.\n//\n")
    b.WriteString("// Completes every exposed enum family: re-exports each member not already\n")
    b.WriteString("// re-exported elsewhere in the shim package, so a plugin that can name the\n")
    b.WriteString("// enum type can name all of its values. Prevents the #230 class (a sibling\n")
    b.WriteString("// const silently missing). Regenerate after a typescript-go bump with\n")
    b.WriteString("// `pnpm --filter ttsc shim:audit -fix`.\n\n")
    fmt.Fprintf(&b, "package %s\n\n", pkgName)
    fmt.Fprintf(&b, "import %s %q\n\n", alias, internalPrefix+pkg)
    b.WriteString("const (\n")
    for _, n := range names {
      fmt.Fprintf(&b, "\t%s = %s.%s\n", n, alias, n)
    }
    b.WriteString(")\n")
    out := filepath.Join(dir, "enums_gen.go")
    formatted, err := format.Source([]byte(b.String()))
    if err != nil {
      fmt.Fprintf(os.Stderr, "shim_audit: format %s: %v\n", out, err)
      formatted = []byte(b.String())
    }
    // Match the repo's gofmt-2spaces convention (see .vscode/gofmt-2spaces.sh)
    // so a later `pnpm format` does not churn these generated files.
    formatted = bytes.ReplaceAll(formatted, []byte("\t"), []byte("  "))
    if err := os.WriteFile(out, formatted, 0o644); err != nil {
      fmt.Fprintln(os.Stderr, "shim_audit:", err)
      os.Exit(1)
    }
    fmt.Printf("shim_audit: wrote %s (%d members)\n", out, len(names))
  }
}

// runWriteBaseline records the current TIER-2/3 gaps as accepted, so the gate
// fails only on NEW ones. Producer exemptions are preserved rather than
// inferred: each root needs an explicit human rationale.
func runWriteBaseline(findings []finding, path string) {
  var keys []string
  for _, f := range findings {
    if f.kind == "FUNC" || f.kind == "ESCAPE" {
      keys = append(keys, findingKey(f))
    }
  }
  sort.Strings(keys)
  producerExemptions := map[string]string{}
  if existing, err := os.ReadFile(path); err == nil {
    var baseline baselineFile
    if err := json.Unmarshal(existing, &baseline); err != nil {
      fmt.Fprintf(os.Stderr, "shim_audit: parse %s: %v\n", path, err)
      os.Exit(2)
    }
    producerExemptions = baseline.ProducerExemptions
  }
  data, err := json.MarshalIndent(baselineFile{
    Note:               "Accepted TIER-2 (reachable funcs) and TIER-3 (escaping types) shim gaps. The gate fails on any gap NOT listed here; expose a symbol and remove its line, or run -write-baseline to accept new ones deliberately. TIER-1 enum and PRODUCER gaps are zero-tolerance; producer_exemptions must name genuine roots or ownership boundaries with non-empty rationales.",
    Accepted:           keys,
    ProducerExemptions: producerExemptions,
  }, "", "  ")
  if err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
    fmt.Fprintln(os.Stderr, "shim_audit:", err)
    os.Exit(1)
  }
  fmt.Printf("shim_audit: wrote %s (%d accepted gaps)\n", path, len(keys))
}

// runCheck is the CI gate. It fails on any TIER-1 enum gap, any unreasoned
// producer gap, or any TIER-2/3 gap not present in the baseline.
func runCheck(findings []finding, surface producerSurface, path string) {
  baseline := baselineFile{}
  if data, err := os.ReadFile(path); err == nil {
    if err := json.Unmarshal(data, &baseline); err != nil {
      fmt.Fprintf(os.Stderr, "shim_audit: parse %s: %v\n", path, err)
      os.Exit(2)
    }
  } else {
    fmt.Fprintf(os.Stderr, "shim_audit: WARNING no baseline at %s; treating all func/type and producer gaps as new\n", path)
  }

  producerEvaluation := evaluateProducerSurface(surface, baseline.ProducerExemptions)
  findings = dedupe(append(findings, producerEvaluation.gaps...))
  evaluation := evaluateBaseline(findings, baseline, producerEvaluation.usedRoots)
  // Non-failing hygiene note: baseline lines that no longer match a gap (the
  // symbol got exposed) are dead weight; the ratchet stays safe but suggest a prune.
  if evaluation.staleAccepted > 0 {
    fmt.Fprintf(os.Stderr, "shim_audit: note: %d baseline entr(y/ies) no longer match a gap; prune with -write-baseline\n", evaluation.staleAccepted)
  }
  if evaluation.staleProducers > 0 {
    fmt.Fprintf(os.Stderr, "shim_audit: note: %d producer exemption(s) no longer match a gap; remove them\n", evaluation.staleProducers)
  }

  if len(evaluation.enumGaps) == 0 && len(evaluation.newGaps) == 0 &&
    len(evaluation.producerGaps) == 0 && len(evaluation.invalidReasons) == 0 {
    fmt.Println("shim_audit: OK — exposed enums, reachable symbols, and compiler-object producers are closed")
    return
  }
  if len(evaluation.enumGaps) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d enum-family member(s) of an EXPOSED enum are not re-exported.\n", len(evaluation.enumGaps))
    fmt.Fprintf(os.Stderr, "  This is the #230 class. Fix mechanically: `pnpm --filter ttsc shim:audit -fix`.\n")
    for _, f := range evaluation.enumGaps {
      fmt.Fprintf(os.Stderr, "    ENUM   %s.%s\n", f.pkg, f.symbol)
    }
  }
  if len(evaluation.newGaps) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d new reachable gap(s) not in the baseline.\n", len(evaluation.newGaps))
    fmt.Fprintf(os.Stderr, "  Expose them in the shim, or accept deliberately: `pnpm --filter ttsc shim:audit -write-baseline`.\n")
    for _, f := range evaluation.newGaps {
      fmt.Fprintf(os.Stderr, "    %-6s %s.%s — %s\n", f.kind, f.pkg, f.symbol, f.detail)
    }
  }
  if len(evaluation.producerGaps) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d consumed compiler object(s) have no public producer.\n", len(evaluation.producerGaps))
    fmt.Fprintf(os.Stderr, "  Add a general exported producer, or document a genuine root or ownership boundary in producer_exemptions.\n")
    for _, f := range evaluation.producerGaps {
      fmt.Fprintf(os.Stderr, "    PRODUCER %s.%s — %s\n", f.pkg, f.symbol, f.detail)
    }
  }
  if len(evaluation.invalidReasons) > 0 {
    fmt.Fprintf(os.Stderr, "\nshim_audit: FAIL — %d producer exemption(s) have an empty rationale.\n", len(evaluation.invalidReasons))
    for _, key := range evaluation.invalidReasons {
      fmt.Fprintf(os.Stderr, "    PRODUCER-EXEMPTION %s\n", key)
    }
  }
  fmt.Fprintln(os.Stderr)
  os.Exit(1)
}
