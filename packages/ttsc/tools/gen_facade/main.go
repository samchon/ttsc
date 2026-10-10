// Package main generates the documented github.com/microsoft/typescript-go/shim/*
// plugin import paths as facades over ttsc's compiler bridges.
//
// The compiler module is github.com/microsoft/TypeScript/tsc. Go admits an
// import of its internal/ tree only from an import path rooted at that module,
// so the maintained bridges under packages/ttsc/shim/<name> are the modules
// github.com/microsoft/TypeScript/tsc/shim/<name>. Plugins keep importing
// github.com/microsoft/typescript-go/shim/<name>: each facade module under
// packages/ttsc/shim/typescript-go/<name> aliases every exported identity of
// its bridge, so both paths name one compiler's types, functions and values.
//
// Usage, from packages/ttsc after the bridges compile:
//
//  go -C tools/gen_facade run .          # write every facade_gen.go
//  go -C tools/gen_facade run . -check   # fail when a committed facade is stale
package main

import (
  "bytes"
  "errors"
  "flag"
  "fmt"
  "go/format"
  "go/types"
  "io/fs"
  "log"
  "maps"
  "os"
  "path/filepath"
  "slices"
  "strings"

  "golang.org/x/mod/modfile"
  "golang.org/x/tools/go/packages"
)

const (
  bridgePrefix   = "github.com/microsoft/TypeScript/tsc/shim/"
  facadePrefix   = "github.com/microsoft/typescript-go/shim/"
  internalPrefix = "github.com/microsoft/TypeScript/tsc/internal/"
  // facadeDirName is the shim-root child that holds the facade modules. The
  // bridge walk never enters it.
  facadeDirName = "typescript-go"
  outputName    = "facade_gen.go"
)

func main() {
  shimRoot := flag.String("shim", "../../shim", "the packages/ttsc/shim directory")
  check := flag.Bool("check", false, "report stale facades without writing them")
  flag.Parse()

  outputs, err := generate(*shimRoot)
  if err != nil {
    log.Fatalf("gen_facade: %v", err)
  }
  var stale []string
  for _, output := range outputs {
    if *check {
      current, err := os.ReadFile(output.path)
      if err != nil || !bytes.Equal(current, output.source) {
        stale = append(stale, output.path)
      }
      continue
    }
    if err := os.MkdirAll(filepath.Dir(output.path), 0o755); err != nil {
      log.Fatalf("gen_facade: %v", err)
    }
    if err := os.WriteFile(output.path, output.source, 0o644); err != nil {
      log.Fatalf("gen_facade: %v", err)
    }
    fmt.Printf("gen_facade: wrote %s\n", output.path)
  }
  if len(stale) > 0 {
    log.Fatalf("gen_facade: stale facades (run go -C tools/gen_facade run .):\n  %s", strings.Join(stale, "\n  "))
  }
}

// facadeOutput is one generated facade file and its destination.
type facadeOutput struct {
  path   string
  source []byte
}

// bridge is one loaded bridge package. rel is its path below the shim root
// and below both module namespaces, such as "vfs/cachedvfs".
type bridge struct {
  rel string
  pkg *types.Package
}

// generate loads every bridge below shimRoot and renders its facade. Nothing
// is written here, so a failed bridge leaves every committed facade untouched.
func generate(shimRoot string) ([]facadeOutput, error) {
  rels, err := discoverBridges(shimRoot)
  if err != nil {
    return nil, err
  }
  bridges := make([]bridge, 0, len(rels))
  for _, rel := range rels {
    pkg, err := loadBridge(filepath.Join(shimRoot, filepath.FromSlash(rel)), bridgePrefix+rel)
    if err != nil {
      return nil, err
    }
    bridges = append(bridges, bridge{rel: rel, pkg: pkg})
  }
  index := newAliasIndex(bridges)
  outputs := make([]facadeOutput, 0, len(bridges))
  var problems []error
  for _, b := range bridges {
    source, imported, err := renderFacade(b, index)
    if err != nil {
      problems = append(problems, err)
      continue
    }
    dir := filepath.Join(shimRoot, facadeDirName, filepath.FromSlash(b.rel))
    manifest, err := facadeManifest(filepath.Join(dir, "go.mod"), b.rel, imported)
    if err != nil {
      problems = append(problems, err)
      continue
    }
    outputs = append(outputs,
      facadeOutput{path: filepath.Join(dir, outputName), source: source},
      facadeOutput{path: filepath.Join(dir, "go.mod"), source: manifest},
    )
  }
  return outputs, errors.Join(problems...)
}

// discoverBridges returns the slash-separated directory of every go.mod below
// shimRoot outside the facade tree, after checking that each declares the
// bridge module its directory names.
func discoverBridges(shimRoot string) ([]string, error) {
  var rels []string
  err := filepath.WalkDir(shimRoot, func(path string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if entry.IsDir() {
      if path == filepath.Join(shimRoot, facadeDirName) {
        return filepath.SkipDir
      }
      return nil
    }
    if entry.Name() != "go.mod" {
      return nil
    }
    data, err := os.ReadFile(path)
    if err != nil {
      return err
    }
    dir, err := filepath.Rel(shimRoot, filepath.Dir(path))
    if err != nil {
      return err
    }
    rel := filepath.ToSlash(dir)
    if module := modfile.ModulePath(data); module != bridgePrefix+rel {
      return fmt.Errorf("%s declares module %q; a bridge in shim/%s must declare %q", path, module, rel, bridgePrefix+rel)
    }
    rels = append(rels, rel)
    return nil
  })
  if err != nil {
    return nil, err
  }
  if len(rels) == 0 {
    return nil, fmt.Errorf("no bridge go.mod below %s", shimRoot)
  }
  slices.Sort(rels)
  return rels, nil
}

// loadBridge type-checks the bridge package rooted at dir. Tests and nested
// packages are not part of a bridge's public surface.
func loadBridge(dir string, importPath string) (*types.Package, error) {
  loaded, err := packages.Load(&packages.Config{
    Dir:  dir,
    Mode: packages.NeedName | packages.NeedTypes,
  }, ".")
  if err != nil {
    return nil, fmt.Errorf("load %s: %w", importPath, err)
  }
  if len(loaded) != 1 {
    return nil, fmt.Errorf("load %s: %d packages, want 1", importPath, len(loaded))
  }
  pkg := loaded[0]
  if len(pkg.Errors) > 0 {
    messages := make([]string, len(pkg.Errors))
    for i, e := range pkg.Errors {
      messages[i] = e.Error()
    }
    return nil, fmt.Errorf("load %s:\n  %s", importPath, strings.Join(messages, "\n  "))
  }
  if pkg.PkgPath != importPath || pkg.Types == nil {
    return nil, fmt.Errorf("load %s: loaded %q", importPath, pkg.PkgPath)
  }
  return pkg.Types, nil
}

// aliasRef names an exported bridge alias of a compiler-internal type.
type aliasRef struct {
  bridgePath string
  name       string
}

// aliasIndex maps "<internal package path>.<type name>" to the bridge alias a
// facade spells that type with. A facade cannot import the internal package,
// so a bridge alias is the only legal spelling of an internal type.
type aliasIndex map[string]aliasRef

// newAliasIndex records every exported bridge alias of an internal named type
// or alias. One internal type exposed by several bridges is spelled through
// the bridge of the same name, then by the alias carrying the type's own name,
// then by the first in import-path order, so output is deterministic.
func newAliasIndex(bridges []bridge) aliasIndex {
  rank := func(key string, ref aliasRef) []string {
    pkgPath, name, _ := strings.Cut(key[len(internalPrefix):], ".")
    sameBridge, sameName := "1", "1"
    if ref.bridgePath == bridgePrefix+pkgPath {
      sameBridge = "0"
    }
    if ref.name == name {
      sameName = "0"
    }
    return []string{sameBridge + sameName, ref.bridgePath, ref.name}
  }
  index := aliasIndex{}
  add := func(key string, ref aliasRef) {
    if current, ok := index[key]; ok && slices.Compare(rank(key, current), rank(key, ref)) <= 0 {
      return
    }
    index[key] = ref
  }
  for _, b := range bridges {
    scope := b.pkg.Scope()
    for _, name := range scope.Names() {
      obj, ok := scope.Lookup(name).(*types.TypeName)
      if !ok || !obj.Exported() || !obj.IsAlias() {
        continue
      }
      alias, ok := obj.Type().(*types.Alias)
      if !ok {
        continue
      }
      ref := aliasRef{bridgePath: b.pkg.Path(), name: name}
      // A chain of internal aliases is spelled by the same bridge alias.
      for {
        rhs := alias.Rhs()
        next, isAlias := rhs.(*types.Alias)
        if isAlias {
          if key, ok := internalKey(next.Obj()); ok && sameTypeParams(alias.TypeParams(), next.TypeArgs()) {
            add(key, ref)
          }
          alias = next
          continue
        }
        if named, isNamed := rhs.(*types.Named); isNamed {
          if key, ok := internalKey(named.Obj()); ok && sameTypeParams(alias.TypeParams(), named.TypeArgs()) {
            add(key, ref)
          }
        }
        break
      }
    }
  }
  return index
}

// internalKey returns the index key of a package-level internal type name.
func internalKey(obj *types.TypeName) (string, bool) {
  if obj.Pkg() == nil || !strings.HasPrefix(obj.Pkg().Path(), internalPrefix) || obj.Parent() != obj.Pkg().Scope() {
    return "", false
  }
  return obj.Pkg().Path() + "." + obj.Name(), true
}

// sameTypeParams reports whether args instantiate a generic type with exactly
// params, in order, so the alias stands for the whole generic type.
func sameTypeParams(params *types.TypeParamList, args *types.TypeList) bool {
  if params.Len() != args.Len() {
    return false
  }
  for i := range params.Len() {
    if arg, ok := args.At(i).(*types.TypeParam); !ok || arg.Obj() != params.At(i).Obj() {
      return false
    }
  }
  return true
}

// importSet assigns each imported package one local name in a facade file.
type importSet struct {
  names map[string]string // path -> local name
  taken map[string]string // local name -> path
}

func newImportSet() *importSet {
  return &importSet{names: map[string]string{}, taken: map[string]string{}}
}

// clone copies s, so a declaration that fails to print can be discarded
// without leaving its imports behind.
func (s *importSet) clone() *importSet {
  return &importSet{names: maps.Clone(s.names), taken: maps.Clone(s.taken)}
}

// local returns the local name of path, whose declared package name is name.
// Bridges are imported as tsc<name> so a facade never shadows its own package.
func (s *importSet) local(path string, name string) string {
  if local, ok := s.names[path]; ok {
    return local
  }
  base := name
  if strings.HasPrefix(path, bridgePrefix) {
    base = "tsc" + name
  }
  local := base
  for i := 2; s.taken[local] != ""; i++ {
    local = fmt.Sprintf("%s%d", base, i)
  }
  s.names[path] = local
  s.taken[local] = path
  return local
}

// printer spells types in a facade file. It refuses a type the facade cannot
// name: an internal type no bridge aliases, or an unexported or local type.
type printer struct {
  imports *importSet
  index   aliasIndex
}

// errUnnameable reports a type a facade cannot spell.
type errUnnameable struct{ what string }

func (e errUnnameable) Error() string { return "cannot name " + e.what }

func (p *printer) qualified(pkg *types.Package, name string) string {
  return p.imports.local(pkg.Path(), pkg.Name()) + "." + name
}

func (p *printer) typeArgs(args *types.TypeList) (string, error) {
  if args.Len() == 0 {
    return "", nil
  }
  parts := make([]string, args.Len())
  for i := range args.Len() {
    part, err := p.typ(args.At(i))
    if err != nil {
      return "", err
    }
    parts[i] = part
  }
  return "[" + strings.Join(parts, ", ") + "]", nil
}

func (p *printer) typeName(obj *types.TypeName, args *types.TypeList) (string, error) {
  if obj.Pkg() == nil {
    return obj.Name(), nil // universe: any, error, comparable
  }
  if !obj.Exported() || obj.Parent() != obj.Pkg().Scope() {
    return "", errUnnameable{obj.Pkg().Path() + "." + obj.Name()}
  }
  base := ""
  if key, internal := internalKey(obj); internal {
    ref, ok := p.index[key]
    if !ok {
      return "", errUnnameable{key}
    }
    base = p.imports.local(ref.bridgePath, bridgeName(ref.bridgePath)) + "." + ref.name
  } else if strings.HasPrefix(obj.Pkg().Path(), internalPrefix) {
    return "", errUnnameable{obj.Pkg().Path() + "." + obj.Name()}
  } else {
    base = p.qualified(obj.Pkg(), obj.Name())
  }
  suffix, err := p.typeArgs(args)
  return base + suffix, err
}

// bridgeName is the declared package name of a bridge: its last path element.
func bridgeName(path string) string {
  return path[strings.LastIndexByte(path, '/')+1:]
}

func (p *printer) typ(t types.Type) (string, error) {
  switch t := t.(type) {
  case *types.Basic:
    if t.Kind() == types.UnsafePointer {
      return p.imports.local("unsafe", "unsafe") + ".Pointer", nil
    }
    return t.Name(), nil
  case *types.Alias:
    obj := t.Obj()
    if obj.Pkg() != nil && strings.HasPrefix(obj.Pkg().Path(), internalPrefix) {
      // An internal alias is spelled by its bridge alias when one exists,
      // otherwise by what it denotes.
      if key, ok := internalKey(obj); ok {
        if _, exposed := p.index[key]; exposed {
          return p.typeName(obj, t.TypeArgs())
        }
      }
      return p.typ(types.Unalias(t))
    }
    return p.typeName(obj, t.TypeArgs())
  case *types.Named:
    return p.typeName(t.Obj(), t.TypeArgs())
  case *types.TypeParam:
    return t.Obj().Name(), nil
  case *types.Pointer:
    elem, err := p.typ(t.Elem())
    return "*" + elem, err
  case *types.Slice:
    elem, err := p.typ(t.Elem())
    return "[]" + elem, err
  case *types.Array:
    elem, err := p.typ(t.Elem())
    return fmt.Sprintf("[%d]%s", t.Len(), elem), err
  case *types.Map:
    key, err := p.typ(t.Key())
    if err != nil {
      return "", err
    }
    elem, err := p.typ(t.Elem())
    return "map[" + key + "]" + elem, err
  case *types.Chan:
    elem, err := p.typ(t.Elem())
    switch t.Dir() {
    case types.SendOnly:
      return "chan<- " + elem, err
    case types.RecvOnly:
      return "<-chan " + elem, err
    }
    return "chan " + elem, err
  case *types.Signature:
    sig, err := p.signature(t, nil)
    return "func" + sig, err
  case *types.Struct:
    fields := make([]string, t.NumFields())
    for i := range t.NumFields() {
      field := t.Field(i)
      typ, err := p.typ(field.Type())
      if err != nil {
        return "", err
      }
      if !field.Embedded() {
        typ = field.Name() + " " + typ
      }
      if tag := t.Tag(i); tag != "" {
        typ += " " + fmt.Sprintf("%q", tag)
      }
      fields[i] = typ
    }
    return "struct{" + strings.Join(fields, "; ") + "}", nil
  case *types.Interface:
    var parts []string
    for i := range t.NumEmbeddeds() {
      part, err := p.typ(t.EmbeddedType(i))
      if err != nil {
        return "", err
      }
      parts = append(parts, part)
    }
    for i := range t.NumExplicitMethods() {
      method := t.ExplicitMethod(i)
      if !method.Exported() {
        return "", errUnnameable{"unexported interface method " + method.Name()}
      }
      sig, err := p.signature(method.Signature(), nil)
      if err != nil {
        return "", err
      }
      parts = append(parts, method.Name()+sig)
    }
    if t.IsImplicit() && len(parts) == 1 {
      return parts[0], nil
    }
    return "interface{" + strings.Join(parts, "; ") + "}", nil
  case *types.Union:
    terms := make([]string, t.Len())
    for i := range t.Len() {
      term, err := p.typ(t.Term(i).Type())
      if err != nil {
        return "", err
      }
      if t.Term(i).Tilde() {
        term = "~" + term
      }
      terms[i] = term
    }
    return strings.Join(terms, " | "), nil
  }
  return "", errUnnameable{fmt.Sprintf("%T %s", t, t)}
}

// typeParams spells a type parameter list as declared, and as used.
func (p *printer) typeParams(list *types.TypeParamList) (string, string, error) {
  if list.Len() == 0 {
    return "", "", nil
  }
  decl := make([]string, list.Len())
  use := make([]string, list.Len())
  for i := range list.Len() {
    param := list.At(i)
    constraint, err := p.typ(param.Constraint())
    if err != nil {
      return "", "", err
    }
    decl[i] = param.Obj().Name() + " " + constraint
    use[i] = param.Obj().Name()
  }
  return "[" + strings.Join(decl, ", ") + "]", "[" + strings.Join(use, ", ") + "]", nil
}

// signature spells sig's parameters and results. With names non-nil, the
// parameters are declared as p0, p1, ... and their names appended to names.
func (p *printer) signature(sig *types.Signature, names *[]string) (string, error) {
  params := make([]string, sig.Params().Len())
  for i := range sig.Params().Len() {
    typ := sig.Params().At(i).Type()
    spelled := ""
    if sig.Variadic() && i == sig.Params().Len()-1 {
      elem, err := p.typ(typ.(*types.Slice).Elem())
      if err != nil {
        return "", err
      }
      spelled = "..." + elem
    } else {
      var err error
      if spelled, err = p.typ(typ); err != nil {
        return "", err
      }
    }
    if names != nil {
      name := fmt.Sprintf("p%d", i)
      *names = append(*names, name)
      spelled = name + " " + spelled
    }
    params[i] = spelled
  }
  results := make([]string, sig.Results().Len())
  for i := range sig.Results().Len() {
    spelled, err := p.typ(sig.Results().At(i).Type())
    if err != nil {
      return "", err
    }
    results[i] = spelled
  }
  out := "(" + strings.Join(params, ", ") + ")"
  switch len(results) {
  case 0:
  case 1:
    out += " " + results[0]
  default:
    out += " (" + strings.Join(results, ", ") + ")"
  }
  return out, nil
}

// renderFacade writes the facade of one bridge: an alias of every exported
// type, a constant or variable of every exported value, and a forwarding
// function of every exported function. A function whose signature names an
// internal type no bridge aliases becomes a variable holding the bridge
// function, which a facade can declare without spelling that type; such a
// generic function cannot be expressed and fails generation.
func renderFacade(b bridge, index aliasIndex) ([]byte, []string, error) {
  imports := newImportSet()
  p := &printer{imports: imports, index: index}
  self := imports.local(b.pkg.Path(), b.pkg.Name())
  var body strings.Builder
  var problems []error
  scope := b.pkg.Scope()
  for _, name := range scope.Names() {
    obj := scope.Lookup(name)
    if !obj.Exported() {
      continue
    }
    target := self + "." + name
    switch obj := obj.(type) {
    case *types.TypeName:
      var params *types.TypeParamList
      switch t := obj.Type().(type) {
      case *types.Alias:
        params = t.TypeParams()
      case *types.Named:
        params = t.TypeParams()
      }
      decl, use, err := p.typeParams(params)
      if err != nil {
        problems = append(problems, fmt.Errorf("%s.%s: %w", b.pkg.Path(), name, err))
        continue
      }
      fmt.Fprintf(&body, "type %s%s = %s%s\n\n", name, decl, target, use)
    case *types.Const:
      fmt.Fprintf(&body, "const %s = %s\n\n", name, target)
    case *types.Var:
      fmt.Fprintf(&body, "var %s = %s\n\n", name, target)
    case *types.Func:
      saved := p.imports.clone()
      forward, err := p.forward(name, target, obj.Signature())
      var unnameable errUnnameable
      switch {
      case err == nil:
        body.WriteString(forward)
      case errors.As(err, &unnameable) && obj.Signature().TypeParams().Len() == 0:
        p.imports = saved
        fmt.Fprintf(&body, "// %s holds the bridge function: its signature uses a type no bridge\n// exposes (%s).\nvar %s = %s\n\n", name, unnameable.what, name, target)
      default:
        problems = append(problems, fmt.Errorf("%s.%s: %w", b.pkg.Path(), name, err))
      }
    }
  }
  if err := errors.Join(problems...); err != nil {
    return nil, nil, err
  }

  var file strings.Builder
  file.WriteString("// Code generated by packages/ttsc/tools/gen_facade. DO NOT EDIT.\n\n")
  fmt.Fprintf(&file, "// Package %s is the documented %s%s plugin import path.\n", b.pkg.Name(), facadePrefix, b.rel)
  fmt.Fprintf(&file, "// It aliases every exported identity of %s, the\n", b.pkg.Path())
  file.WriteString("// bridge that reaches the compiler's internal packages.\n")
  fmt.Fprintf(&file, "package %s\n\n", b.pkg.Name())
  imports = p.imports
  paths := make([]string, 0, len(imports.names))
  for path := range imports.names {
    paths = append(paths, path)
  }
  slices.Sort(paths)
  file.WriteString("import (\n")
  for _, path := range paths {
    fmt.Fprintf(&file, "\t%s %q\n", imports.names[path], path)
  }
  file.WriteString(")\n\n")
  file.WriteString(body.String())

  formatted, err := format.Source([]byte(file.String()))
  if err != nil {
    return nil, nil, fmt.Errorf("format facade of %s: %w\n%s", b.pkg.Path(), err, file.String())
  }
  var bridges []string
  for _, path := range paths {
    if strings.HasPrefix(path, bridgePrefix) {
      bridges = append(bridges, path)
    }
  }
  return spaceIndent(formatted), bridges, nil
}

// facadeManifest returns the facade's go.mod with exactly one requirement and
// one relative replacement per bridge the facade imports. Every other line,
// including the compiler and indirect requirements that go mod tidy records,
// is preserved; run go mod tidy after a facade gains a bridge so go.sum follows.
func facadeManifest(path string, rel string, bridges []string) ([]byte, error) {
  data, err := os.ReadFile(path)
  if err != nil {
    return nil, err
  }
  file, err := modfile.Parse(path, data, nil)
  if err != nil {
    return nil, err
  }
  if want := facadePrefix + rel; file.Module == nil || file.Module.Mod.Path != want {
    return nil, fmt.Errorf("%s must declare module %s", path, want)
  }
  needed := map[string]bool{}
  for _, bridge := range bridges {
    needed[bridge] = true
  }
  for _, require := range slices.Clone(file.Require) {
    if strings.HasPrefix(require.Mod.Path, bridgePrefix) && !needed[require.Mod.Path] {
      if err := file.DropRequire(require.Mod.Path); err != nil {
        return nil, err
      }
    }
  }
  for _, replace := range slices.Clone(file.Replace) {
    if strings.HasPrefix(replace.Old.Path, bridgePrefix) && !needed[replace.Old.Path] {
      if err := file.DropReplace(replace.Old.Path, replace.Old.Version); err != nil {
        return nil, err
      }
    }
  }
  up := strings.Repeat("../", strings.Count(rel, "/")+2)
  for _, bridge := range bridges {
    if err := file.AddRequire(bridge, "v0.0.0"); err != nil {
      return nil, err
    }
    if err := file.AddReplace(bridge, "", up+strings.TrimPrefix(bridge, bridgePrefix), ""); err != nil {
      return nil, err
    }
  }
  file.Cleanup()
  return modfile.Format(file.Syntax), nil
}

// forward spells a function that calls the bridge function target.
func (p *printer) forward(name string, target string, sig *types.Signature) (string, error) {
  decl, use, err := p.typeParams(sig.TypeParams())
  if err != nil {
    return "", err
  }
  var names []string
  spelled, err := p.signature(sig, &names)
  if err != nil {
    return "", err
  }
  args := strings.Join(names, ", ")
  if sig.Variadic() {
    args += "..."
  }
  call := target + use + "(" + args + ")"
  if sig.Results().Len() > 0 {
    call = "return " + call
  }
  return fmt.Sprintf("func %s%s%s {\n\t%s\n}\n\n", name, decl, spelled, call), nil
}

// spaceIndent applies the repository's Go layout, gofmt with two-space
// indentation, so committed facades are byte-identical to generator output.
// Generated facades contain no multi-line literal, so every tab is indentation.
func spaceIndent(source []byte) []byte {
  return bytes.ReplaceAll(source, []byte("\t"), []byte("  "))
}
