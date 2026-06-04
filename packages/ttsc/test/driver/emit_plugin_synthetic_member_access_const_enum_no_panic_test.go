package driver_test

// R4: the const-enum inliner must survive plugin-built member accesses.
//
// tsgo's ConstEnumInliningTransformer calls EmitResolver.GetConstantValue on
// every property/element access it visits during emit, including the synthetic
// nodes a plugin injects. The checker can nil-panic computing a type for such a
// node, so the driver wraps the resolver in an unexported guardedEmitResolver
// whose GetConstantValue recovers any panic to nil ("not a const-enum member").
//
// This test drives the full emit pipeline with a const enum present (so the
// inliner runs and visits every property/element access) and a plugin that
// injects a synthetic property access AND a synthetic element access. Emit must
// complete without panic, the real const-enum references must be inlined
// (proving the inliner is active over the transformed tree), and the synthetic
// accesses must survive verbatim. This locks the integration-level contract
// that a plugin may freely inject member-access AST into a const-enum project
// without crashing emit, which is exactly the path the guardedEmitResolver
// recover backstops.

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func TestEmitWithSyntheticMemberAccessDoesNotPanicWithConstEnum(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"module":"commonjs","target":"es2020","outDir":"bin","strict":true},"files":["index.ts"]}`)
  writeProjectFile(t, root, "index.ts", "const enum E { A = 1, B = 2 }\nexport const a = 0;\nexport const e = E.A;\nexport const f = E.B;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // The plugin replaces the `0` initializer with a synthetic element access
  // built on top of a synthetic property access: `synthObj.X[3]`. Both are
  // property/element accesses, so the const-enum inliner's visitor descends
  // into them and calls GetConstantValue on each.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "0" {
        obj := ec.Factory.NewIdentifier("synthObj")
        prop := ec.Factory.NewPropertyAccessExpression(obj, nil, ec.Factory.NewIdentifier("X"), shimast.NodeFlagsNone)
        idx := ec.Factory.NewNumericLiteral("3", 0)
        return ec.Factory.NewElementAccessExpression(prop, nil, idx, shimast.NodeFlagsNone)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  emitted := map[string]string{}
  // EmitWithPluginTransformer would panic here (and fail the test) if the
  // const-enum inliner hit GetConstantValue on the synthetic access unguarded.
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }

  js := emitted["index.js"]
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v", emitted)
  }
  t.Logf("index.js:\n%s", js)
  // Inliner is active: the real const-enum references collapse to their values.
  if !strings.Contains(js, "exports.e = 1 /* E.A */;") || !strings.Contains(js, "exports.f = 2 /* E.B */;") {
    t.Fatalf("const-enum inliner did not run over the transformed tree:\n%s", js)
  }
  // The plugin-built synthetic accesses survive verbatim (not inlined, not lost).
  if !strings.Contains(js, "exports.a = synthObj.X[3];") {
    t.Fatalf("synthetic member access was dropped or mangled:\n%s", js)
  }
}
