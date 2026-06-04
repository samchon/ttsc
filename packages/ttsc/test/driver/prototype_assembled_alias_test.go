package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// assembledEmitHost implements printer.EmitHost by delegating to driver.Program
// (the same delegation tsgo's internal emitHost does). It carries the emit
// resolver from the program's single checker.
type assembledEmitHost struct {
  program      *shimcompiler.Program
  emitResolver shimprinter.EmitResolver
}

func (h *assembledEmitHost) Options() *shimcore.CompilerOptions { return h.program.Options() }
func (h *assembledEmitHost) SourceFiles() []*shimast.SourceFile { return h.program.SourceFiles() }
func (h *assembledEmitHost) UseCaseSensitiveFileNames() bool {
  return h.program.UseCaseSensitiveFileNames()
}
func (h *assembledEmitHost) GetCurrentDirectory() string   { return h.program.GetCurrentDirectory() }
func (h *assembledEmitHost) CommonSourceDirectory() string { return h.program.CommonSourceDirectory() }
func (h *assembledEmitHost) IsEmitBlocked(file string) bool { return h.program.IsEmitBlocked(file) }
func (h *assembledEmitHost) WriteFile(fileName string, text string) error {
  return h.program.Host().FS().WriteFile(fileName, text)
}
func (h *assembledEmitHost) GetEmitModuleFormatOfFile(file shimast.HasFileName) shimcore.ModuleKind {
  return h.program.GetEmitModuleFormatOfFile(file)
}
func (h *assembledEmitHost) GetEmitResolver() shimprinter.EmitResolver { return h.emitResolver }
func (h *assembledEmitHost) GetProjectReferenceFromSource(path shimtspath.Path) *shimtsoptions.SourceOutputAndProjectReference {
  return h.program.GetProjectReferenceFromSource(path)
}
func (h *assembledEmitHost) IsSourceFileFromExternalLibrary(file *shimast.SourceFile) bool {
  return h.program.IsSourceFileFromExternalLibrary(file)
}

// TestPrototypeAssembledAlias proves the AST-integration core: ttsc assembles
// the emit pipeline from shimmed tsgo parts, runs a plugin transformer FIRST in
// the same EmitContext as the builtins (here a stand-in that replaces `foo`
// with a synthetic identifier and SetOriginal-links it to the parse-tree node),
// then the builtin module-transform aliases it to dep_1.foo on its own. No
// text-splice, no hand-rolled commonJS naming.
func TestPrototypeAssembledAlias(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020", "outDir": "bin", "strict": true },
  "files": ["dep.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "dep.ts", "export const foo: number = 1;\n")
  writeProjectFile(t, root, "index.ts", "import { foo } from \"./dep\";\nexport const a = foo;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  sf := prog.SourceFile(filepath.Join(root, "index.ts"))
  if sf == nil {
    t.Fatal("SourceFile did not find index.ts")
  }

  ec := shimprinter.NewEmitContext()
  host := &assembledEmitHost{program: prog.TSProgram, emitResolver: prog.Checker.GetEmitResolver()}

  // Plugin transformer stand-in: replace every parse-tree `foo` with a fresh
  // node built by the EMIT EmitContext's factory, linked to the original via
  // SetOriginal so MostOriginal walks back to the parse-tree node.
  var visitor *shimast.NodeVisitor
  visit := func(node *shimast.Node) *shimast.Node {
    if node != nil && node.Kind == shimast.KindIdentifier && node.Text() == "foo" {
      syn := ec.Factory.NewIdentifier("foo")
      ec.SetOriginal(syn, node)
      return syn
    }
    return visitor.VisitEachChild(node)
  }
  visitor = ec.NewNodeVisitor(visit)
  transformed := visitor.VisitSourceFile(sf)
  shimast.SetParentInChildren(transformed.AsNode())

  // builtin emit chain (type-erase, import-elision, module-transform, ...) in
  // the SAME EmitContext, applied after the plugin transformer.
  builtins := shimcompiler.GetScriptTransformers(ec, host, transformed)
  out := transformed
  for _, tr := range builtins {
    out = tr.TransformSourceFile(out)
  }

  writer := shimprinter.NewTextWriter("\n", 0)
  p := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, ec)
  p.Write(out.AsNode(), out, writer, nil)
  text := writer.String()
  t.Logf("assembled emit:\n%s", text)
  if !strings.Contains(text, "dep_1.foo") {
    t.Fatalf("synthetic foo was NOT aliased by module-transform:\n%s", text)
  }
}
