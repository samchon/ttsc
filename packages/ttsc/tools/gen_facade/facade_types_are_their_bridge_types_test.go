package main

import (
  "go/types"
  "os"
  "path/filepath"
  "testing"

  "golang.org/x/tools/go/packages"
)

// Verifies each documented TypeScript 7.1 import path names the bridge's own
// types rather than copies of them.
//
// A plugin can import github.com/microsoft/typescript-go/shim/ast while ttsc's
// driver imports the bridge or another facade. A facade type that were a new
// defined type would make a value from one path unusable through the other.
//
//  1. Load every committed facade module with its dependencies.
//  2. For every exported facade type that its bridge also exports, require an
//     alias whose type is identical to the bridge's.
//  3. Spot-check the AST node, checker and Program identities by name.
//
// @evidence contracts/testing.md#behavioral-verification Type-checks the real facade and bridge modules through go/packages and asserts types.Identical for every exported pair, so a defined type, a wrong alias target or a missing alias fails.
// @evidence contracts/testing.md#independent-expectations The expected relation, one identical type per documented name, is the facade contract itself; the spot-checked names are written literally rather than read from generator output.
// @evidence contracts/testing.md#distinguishing-cases Covers every facade package, nested paths such as vfs/cachedvfs, generic and non-generic aliases, and the three named identities plugins and the driver exchange most.
// @evidence contracts/testing.md#execution-ownership This tools/gen_facade unit loads the committed modules through the go command in its own process and writes no file.
func TestFacadeTypesAreTheirBridgeTypes(t *testing.T) {
  facadeRoot := filepath.Join("..", "..", "targets", "7.1", "facade")
  var dirs []string
  err := filepath.WalkDir(facadeRoot, func(path string, entry os.DirEntry, err error) error {
    if err == nil && !entry.IsDir() && entry.Name() == "go.mod" {
      dirs = append(dirs, filepath.Dir(path))
    }
    return err
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(dirs) == 0 {
    t.Fatal("no facade modules found")
  }
  checked := map[string]bool{}
  for _, dir := range dirs {
    loaded, err := packages.Load(&packages.Config{
      Dir:  dir,
      Env:  standaloneModuleEnv(),
      Mode: packages.NeedName | packages.NeedTypes | packages.NeedImports | packages.NeedDeps,
    }, ".")
    if err != nil || len(loaded) != 1 || len(loaded[0].Errors) > 0 {
      t.Fatalf("load %s: %v %v", dir, err, loaded)
    }
    facade := loaded[0]
    bridgePath := bridgePrefix + facade.PkgPath[len(facadePrefix):]
    bridge := facade.Imports[bridgePath]
    if bridge == nil {
      t.Fatalf("%s does not import its bridge %s", facade.PkgPath, bridgePath)
    }
    for _, name := range facade.Types.Scope().Names() {
      object, ok := facade.Types.Scope().Lookup(name).(*types.TypeName)
      if !ok || !object.Exported() {
        continue
      }
      original, ok := bridge.Types.Scope().Lookup(name).(*types.TypeName)
      if !ok {
        continue
      }
      if !aliasesBridgeType(object, original) {
        t.Errorf("%s.%s is not the bridge's %s", facade.PkgPath, name, original.Type())
      }
      checked[facade.PkgPath[len(facadePrefix):]+"."+name] = true
    }
  }
  for _, name := range []string{"ast.Node", "ast.SourceFile", "ast.Symbol", "checker.Checker", "compiler.Program", "vfs/cachedvfs.FS"} {
    if !checked[name] {
      t.Errorf("identity of %s was not checked", name)
    }
  }
}

// aliasesBridgeType reports whether the facade type is an alias of original.
// A generic alias declares its own type parameters, so original is
// instantiated with them before the comparison.
func aliasesBridgeType(object *types.TypeName, original *types.TypeName) bool {
  alias, ok := object.Type().(*types.Alias)
  if !ok || !object.IsAlias() {
    return false
  }
  params := alias.TypeParams()
  if params.Len() == 0 {
    return types.Identical(alias, original.Type())
  }
  args := make([]types.Type, params.Len())
  for i := range params.Len() {
    args[i] = params.At(i)
  }
  instance, err := types.Instantiate(nil, original.Type(), args, true)
  return err == nil && types.Identical(alias.Rhs(), instance)
}
