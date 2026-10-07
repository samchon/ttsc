package driver_test

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  "github.com/samchon/ttsc/packages/ttsc/driver"
  "path/filepath"
  "strings"
  "testing"
)

// TestEmitWithPluginTransformerNamespace Verifies a sibling rewrite retains the exported
// namespace writeback and member assignment.
//
// The plugin changes a sibling while leaving the parsed namespace intact. Replacing
// original parents during source-file reconstruction can lose the namespace export
// writeback, so the member assignment and outer export are separate required controls.
//
// 1. Load the namespace fixture and transform its sibling literal.
// 2. Require clean load and emit, the changed sibling, retained Foo.bar and namespace export writeback.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual sibling-literal transformation and requires clean load/emit, changed exports.x, a Foo.bar assignment and exported namespace writeback.
// @evidence contracts/testing.md#independent-expectations Authored Foo/bar and literal sibling replacement one independently define namespace member and transform-control expectations.
// @evidence contracts/testing.md#distinguishing-cases Unchanged exported namespace and changed sibling coexist; the control rewrite rejects a plain emitter that never ran the visitor.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit invokes direct compiler/transformer APIs with captured writes and private Program cleanup; no product binary or runtime consumer runs.
func TestEmitWithPluginTransformerNamespace(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "export namespace Foo { export const bar = (k: string): string[] => [k]; }\nexport const x: number = 0;\n")
  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil || len(diagnostics) != 0 {
    t.Fatalf("load: %v %v", err, diagnostics)
  }
  defer prog.Close()
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var v *shimast.NodeVisitor
    visit := func(n *shimast.Node) *shimast.Node {
      if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == "0" {
        return ec.Factory.NewNumericLiteral("1", 0)
      }
      return v.VisitEachChild(n)
    }
    v = ec.NewNodeVisitor(visit)
    return v.VisitSourceFile(sf)
  }
  emitted := map[string]string{}
  diagnostics, err = prog.EmitWithPluginTransformer(transform, func(fn, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fn)] = text
    return nil
  })
  if err != nil || len(diagnostics) != 0 {
    t.Fatalf("emit: %v %v", err, diagnostics)
  }
  js := emitted["index.js"]
  if !strings.Contains(js, "exports.x = 1;") || !strings.Contains(js, "Foo.bar") {
    t.Fatalf("plugin control rewrite or exported namespace member missing:\n%s", js)
  }
  if !strings.Contains(js, "Foo.bar =") {
    t.Fatalf("exported namespace member assignment missing:\n%s", js)
  }
  if strings.Contains(js, "exports.Foo = Foo = {}") {
    t.Logf("OK namespace emitted")
  } else {
    t.Errorf("BROKEN namespace:\n%s", js)
  }
}
