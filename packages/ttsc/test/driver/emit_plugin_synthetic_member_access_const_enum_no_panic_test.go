package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithSyntheticMemberAccessDoesNotPanicWithConstEnum Verifies synthetic member access
// emits without panic while genuine const-enum members remain inlined.
//
// The inliner follows original mappings before consulting the resolver. An
// emit-factory access has no parse original and must never enter the checker,
// while genuine enum members still resolve to their constants.
//
// 1. Load a const-enum project and inject nested synthetic member accesses.
// 2. Emit through the real plugin pipeline.
// 3. Assert both real enum inlining and unchanged generated accesses.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual synthetic member injection and plugin emission, requiring clean result, real enum constants one/two and intact synthObj.X[3] output.
// @evidence contracts/testing.md#independent-expectations Explicit enum constants and independently constructed generated access define the expected output relationships.
// @evidence contracts/testing.md#distinguishing-cases Nested synthetic property/element access contrasts real enum member accesses in the same program, requiring retained generated access alongside active real-member inlining without observing individual checker calls.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit invokes real compiler/visitor APIs with private Program and captured writes and deferred close; successful emitted structure, not runtime binding of synthObj, is claimed.
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
  // into them while ParseNode excludes them from constant resolution.
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
  // An unhandled emit panic fails this test; the output checks below also
  // require genuine enum inlining and intact generated accesses. The unit
  // does not remove the resolver guard or observe individual checker calls.
  if diagnostics, err := prog.EmitWithPluginTransformer(transform, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  }); err != nil || len(diagnostics) != 0 {
    t.Fatalf("emit: %v %v", err, diagnostics)
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
