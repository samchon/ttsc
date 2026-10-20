package main

import (
  "go/ast"
  "go/parser"
  "go/token"
  "go/types"
  "runtime"
  "strings"
  "testing"
)

// Verifies mirror generation terminates on a cycle of unexported structs and
// declares every mirror once with the original layout.
//
// TypeScript 7.1's Checker reaches unexported structs that point back at each
// other, and the unguarded recursion overflowed the stack. The mirrors back
// unsafe field reads, so each must keep its original's size and offsets.
//
//  1. Type-check a Checker whose unexported node and edge structs form a cycle,
//     reached through two fields, beside an exported pointer and a scalar.
//  2. Generate the mirrors and count each declaration.
//  3. Type-check the mirrors and compare their sizes and offsets with the originals.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production writeMirrorStructs over go/types structs and type-checks its output; the declaration counts and layout comparison catch unbounded recursion, a duplicate mirror, a value-typed mirror field or a dropped field.
// @evidence contracts/testing.md#independent-expectations The authored fixture fixes which structs are unexported and cyclic, so the expected mirror set and single declarations follow from it; Go's gc size model independently supplies sizes and offsets.
// @evidence contracts/testing.md#distinguishing-cases A two-struct cycle, a struct reached through two fields, an exported pointer that must stay unmirrored, and a scalar field each require a different spelling.
// @evidence contracts/testing.md#execution-ownership This tools/gen_shims source unit parses and type-checks in memory in one Go process; it loads no module, writes no file and starts no process.
func TestMirrorStructsTerminateOnUnexportedCycles(t *testing.T) {
  fset := token.NewFileSet()
  upstreamFile, err := parser.ParseFile(fset, "upstream.go", `package checker
type Program struct{ files []string }
type node struct {
  next  *node
  edges *edge
  depth int
}
type edge struct {
  from *node
  to   *node
}
type Checker struct {
  program *Program
  root    *node
  spare   *node
  count   int
}
`, 0)
  if err != nil {
    t.Fatal(err)
  }
  upstream, err := (&types.Config{}).Check(tsgoInternalPrefix+"checker", fset, []*ast.File{upstreamFile}, nil)
  if err != nil {
    t.Fatal(err)
  }
  checker := upstream.Scope().Lookup("Checker").Type().Underlying().(*types.Struct)

  var out strings.Builder
  writeMirrorStructs(&out, "Checker", checker, map[string]bool{}, func(t types.Type) string {
    return types.TypeString(t, func(*types.Package) string { return "" })
  })
  generated := out.String()
  for _, mirror := range []string{"extra_Checker", "extra_node", "extra_edge"} {
    if count := strings.Count(generated, "type "+mirror+" struct"); count != 1 {
      t.Fatalf("%s declared %d times:\n%s", mirror, count, generated)
    }
  }
  if strings.Contains(generated, "extra_Program") || !strings.Contains(generated, "program *Program") {
    t.Fatalf("exported pointer field was mirrored instead of spelled:\n%s", generated)
  }

  // The exported Program stays spelled by name, so the mirror file declares
  // the same layout under that name.
  mirrorFile, err := parser.ParseFile(fset, "mirror.go", "package mirror\ntype Program struct{ files []string }\n"+generated, 0)
  if err != nil {
    t.Fatalf("%v:\n%s", err, generated)
  }
  mirrors, err := (&types.Config{}).Check("fixture/mirror", fset, []*ast.File{mirrorFile}, nil)
  if err != nil {
    t.Fatalf("%v:\n%s", err, generated)
  }
  sizes := types.SizesFor("gc", runtime.GOARCH)
  for _, name := range []string{"Checker", "node", "edge"} {
    original := upstream.Scope().Lookup(name).Type().Underlying().(*types.Struct)
    mirror := mirrors.Scope().Lookup("extra_" + name).Type().Underlying().(*types.Struct)
    if original.NumFields() != mirror.NumFields() || sizes.Sizeof(original) != sizes.Sizeof(mirror) {
      t.Fatalf("extra_%s does not keep %s's layout", name, name)
    }
    originalFields := make([]*types.Var, original.NumFields())
    mirrorFields := make([]*types.Var, mirror.NumFields())
    for i := range originalFields {
      originalFields[i], mirrorFields[i] = original.Field(i), mirror.Field(i)
    }
    originalOffsets, mirrorOffsets := sizes.Offsetsof(originalFields), sizes.Offsetsof(mirrorFields)
    for i := range originalOffsets {
      if originalOffsets[i] != mirrorOffsets[i] || original.Field(i).Name() != mirror.Field(i).Name() {
        t.Fatalf("extra_%s field %d moved", name, i)
      }
    }
  }
}
