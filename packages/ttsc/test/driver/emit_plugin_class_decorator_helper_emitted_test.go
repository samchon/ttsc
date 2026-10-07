package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerClassDecoratorHelper Verifies rewriting a decorated class field
// retains the decorator helper and class application.
//
// If the synthetic plugin transform clobbered the decorator (lost original
// links, dropped the modifier, or skipped helper emission), the emitted JS would
// be missing either the `__decorate` helper definition or its application call,
// and this test would fail.
//
// 1. Transform the decorated class field initializer to 8.
// 2. Require the rewritten field, __decorate definition and decorator application assigned to Widget.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual plugin-transform emitter and requires rewritten this.size = 8, a __decorate helper definition and decorator application assigned to Widget.
// @evidence contracts/testing.md#independent-expectations Authored size replacement 8, seal decorator and Widget class independently establish required generated structures.
// @evidence contracts/testing.md#distinguishing-cases An unrelated numeric replacement and retained class decorator coexist, distinguishing plugin execution from loss of built-in decorator lowering.
// @evidence contracts/testing.md#execution-ownership The owning Go unit invokes an in-process compiler/transformer with a private Program and captured callbacks and deferred close, without a product host.
func TestEmitWithPluginTransformerClassDecoratorHelper(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", strings.Join([]string{
    `function seal(target: Function): void { Object.seal(target); }`,
    `@seal`,
    `export class Widget {`,
    `  public size: number = 7;`,
    `}`,
    ``,
  }, "\n"))
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  // Plugin transform: rewrite the field initializer `7` to `8`, proving the
  // plugin visitor ran over the same SourceFile that carries the decorated
  // class. Everything else is left to tsgo's builtin transforms.
  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindNumericLiteral && node.Text() == "7" {
        return ec.Factory.NewNumericLiteral("8", 0)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js := emitted["index.js"]
  t.Logf("index.js:\n%s", js)

  // The plugin transform must have run.
  if !strings.Contains(js, "this.size = 8") {
    t.Fatalf("plugin transform did not rewrite the field initializer (expected `this.size = 8`):\n%s", js)
  }
  // The decorator helper must be injected by the printer.
  if !strings.Contains(js, "var __decorate =") {
    t.Fatalf("__decorate helper was not injected into emit:\n%s", js)
  }
  // The decorator must be applied to the class.
  if !strings.Contains(js, "__decorate([") || !strings.Contains(js, "seal") {
    t.Fatalf("@seal decorator was not lowered into a __decorate application:\n%s", js)
  }
  if !strings.Contains(js, "Widget = __decorate([") {
    t.Fatalf("the __decorate application is not assigned back to the class binding:\n%s", js)
  }
}
