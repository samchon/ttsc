package main

import (
  "go/ast"
  "go/importer"
  "go/parser"
  "go/token"
  "go/types"
  "runtime"
  "slices"
  "strings"
  "testing"
)

// Verifies private field support preserves the complete upstream struct layout.
//
// Reading one private field still requires every preceding and following field
// to retain its actual Go type and alignment. The generated accessor must stay
// private rather than becoming an uninitialized compiler-state producer.
//
//  1. Type-check a literal struct with slice, interface and pointer fields.
//  2. Generate and type-check the real support against those exact types.
//  3. Compare field order, types, size and offsets, and reject an absent field.
//
// @evidence contracts/testing.md#behavioral-verification Real support generation and Go type checking verify the mirror layout and accessor signature; complete layout and private getter assertions detect changed field offsets or an unintended public producer, without executing an unsafe getter read.
// @evidence contracts/testing.md#independent-expectations The authored upstream fixture fixes four ordered fields and the selected impl pointer. Go's architecture-specific size authority independently establishes alignment and offsets.
// @evidence contracts/testing.md#distinguishing-cases Slice, interface and pointer fields surround the accessed field; an unknown field must fail, and only the selected private accessor may exist.
// @evidence contracts/testing.md#execution-ownership This generator source unit runs in tools/gen_shims in one Go process using parser and type-checker operations without a native artifact, installation or subprocess.
func TestPrivateFieldSupportPreservesUpstreamLayout(t *testing.T) {
  fset := token.NewFileSet()
  upstreamFile, err := parser.ParseFile(fset, "upstream.go", `package checker
type Context struct{}
type Implementation struct{}
type Host interface{ CurrentDirectory() string }
type Verbosity struct{ Level int }
type NodeBuilder struct {
  contexts []*Context
  host Host
  impl *Implementation
  verbosity *Verbosity
}
`, 0)
  if err != nil {
    t.Fatal(err)
  }
  upstream, err := (&types.Config{}).Check(tsgoInternalPrefix+"checker", fset, []*ast.File{upstreamFile}, nil)
  if err != nil {
    t.Fatal(err)
  }
  named := upstream.Scope().Lookup("NodeBuilder").Type().(*types.Named)
  output, err := generatePrivateFieldSupport(named, []string{"impl"}, "checker")
  if err != nil {
    t.Fatal(err)
  }
  generated, err := parser.ParseFile(fset, "generated.go", output, 0)
  if err != nil {
    t.Fatal(err)
  }
  checked, err := (&types.Config{Importer: fieldSupportImporter{upstream}}).Check("fixture/shim/checker", fset, []*ast.File{generated}, nil)
  if err != nil {
    t.Fatal(err)
  }
  mirror := checked.Scope().Lookup("extra_NodeBuilder").Type().Underlying().(*types.Struct)
  original := named.Underlying().(*types.Struct)
  expected := []string{"contexts", "host", "impl", "verbosity"}
  originalFields := make([]*types.Var, 4)
  mirrorFields := make([]*types.Var, 4)
  if mirror.NumFields() != len(expected) {
    t.Fatalf("mirror fields = %d", mirror.NumFields())
  }
  for index, name := range expected {
    if mirror.Field(index).Name() != name || !types.Identical(mirror.Field(index).Type(), original.Field(index).Type()) {
      t.Fatalf("field %d lost the authored %s identity", index, name)
    }
    originalFields[index], mirrorFields[index] = original.Field(index), mirror.Field(index)
  }
  sizes := types.SizesFor("gc", runtime.GOARCH)
  if sizes.Sizeof(original) != sizes.Sizeof(mirror) || !slices.Equal(sizes.Offsetsof(originalFields), sizes.Offsetsof(mirrorFields)) {
    t.Fatal("generated mirror changes native field alignment")
  }
  getter := checked.Scope().Lookup("nodeBuilder_impl")
  if getter == nil || getter.Exported() || checked.Scope().Lookup("NodeBuilder_impl") != nil {
    t.Fatal("field support must expose only a private accessor")
  }
  signature := getter.Type().(*types.Signature)
  if !types.Identical(signature.Results().At(0).Type(), original.Field(2).Type()) {
    t.Fatal("getter result lost impl type")
  }
  if strings.Count(string(output), "func ") != 1 {
    t.Fatal("unrequested field accessor generated")
  }
  if _, err := generatePrivateFieldSupport(named, []string{"missing"}, "checker"); err == nil {
    t.Fatal("absent field was accepted")
  }
}

type fieldSupportImporter struct{ upstream *types.Package }

func (i fieldSupportImporter) Import(path string) (*types.Package, error) {
  if path == i.upstream.Path() {
    return i.upstream, nil
  }
  return importer.Default().Import(path)
}
