package driver

import (
  "errors"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// pluginEmitHost implements printer.EmitHost (and, structurally,
// SourceFileMayBeEmittedHost + OutputPathsHost — their methods are a subset) by
// delegating to the driver Program, exactly like tsgo's internal emitHost. It
// carries the emit resolver from the program's single checker.
type pluginEmitHost struct {
  program      *shimcompiler.Program
  emitResolver shimprinter.EmitResolver
}

func (h *pluginEmitHost) Options() *shimcore.CompilerOptions { return h.program.Options() }
func (h *pluginEmitHost) SourceFiles() []*shimast.SourceFile { return h.program.SourceFiles() }
func (h *pluginEmitHost) UseCaseSensitiveFileNames() bool {
  return h.program.UseCaseSensitiveFileNames()
}
func (h *pluginEmitHost) GetCurrentDirectory() string   { return h.program.GetCurrentDirectory() }
func (h *pluginEmitHost) CommonSourceDirectory() string { return h.program.CommonSourceDirectory() }
func (h *pluginEmitHost) IsEmitBlocked(file string) bool { return h.program.IsEmitBlocked(file) }
func (h *pluginEmitHost) WriteFile(fileName string, text string) error {
  return h.program.Host().FS().WriteFile(fileName, text)
}
func (h *pluginEmitHost) GetEmitModuleFormatOfFile(file shimast.HasFileName) shimcore.ModuleKind {
  return h.program.GetEmitModuleFormatOfFile(file)
}
func (h *pluginEmitHost) GetEmitResolver() shimprinter.EmitResolver {
  return guardedEmitResolver{h.emitResolver}
}

// guardedEmitResolver makes tsgo's const-enum inliner safe against plugin-built
// nodes. The inliner calls GetConstantValue on every property/element access it
// visits — including synthetic ones a plugin injects — and tsgo's checker can
// nil-panic while computing a contextual type for such a node. A failure there
// only means "not a const enum", so recover to nil and leave the node as-is.
type guardedEmitResolver struct {
  shimprinter.EmitResolver
}

func (g guardedEmitResolver) GetConstantValue(node *shimast.Node) (result any) {
  defer func() {
    if recover() != nil {
      result = nil
    }
  }()
  return g.EmitResolver.GetConstantValue(node)
}
func (h *pluginEmitHost) GetProjectReferenceFromSource(path shimtspath.Path) *shimtsoptions.SourceOutputAndProjectReference {
  return h.program.GetProjectReferenceFromSource(path)
}
func (h *pluginEmitHost) IsSourceFileFromExternalLibrary(file *shimast.SourceFile) bool {
  return h.program.IsSourceFileFromExternalLibrary(file)
}

// PluginTransform transforms one source file in the emit phase, bound to the
// emit EmitContext: nodes it builds with ec.Factory (and links with
// ec.SetOriginal) are recognized and aliased by tsgo's builtin module-transform.
// Returning nil leaves the file unchanged. This is the AST-integration contract
// that replaces text-splice: a plugin returns AST, not text. The shape mirrors a
// classic ts.TransformerFactory (SourceFile -> SourceFile) so an existing
// node-based transformer plugs in by just accepting the EmitContext.
type PluginTransform func(ec *shimprinter.EmitContext, sourceFile *shimast.SourceFile) *shimast.SourceFile

// EmitWithPluginTransformer emits with a single plugin transformer. It is a thin
// wrapper over EmitWithPluginTransformers.
func (p *Program) EmitWithPluginTransformer(transform PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  return p.EmitWithPluginTransformers([]PluginTransform{transform}, writeFile)
}

// EmitLinkedTransforms emits using the emit-phase transformers contributed by
// every registered EmitTransformPlugin (in registration order). This is the
// AST-integration emit path that replaces the ProgramPlugin + RewriteSet
// text-splice path.
func (p *Program) EmitLinkedTransforms(writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, errors.New("driver: nil program")
  }
  transforms, err := p.plugins.emitTransforms()
  if err != nil {
    return nil, err
  }
  return p.EmitWithPluginTransformers(transforms, writeFile)
}

// EmitWithPluginTransformers emits every source file by assembling tsgo's emit
// pipeline from shim parts and running the plugin transformers FIRST (in order)
// in the same EmitContext as the builtin chain (type-erase, import-elision,
// module-transform, ...). No text-splice and no hand-rolled import aliasing:
// tsgo's module-transform aliases the plugins' injected imports itself.
func (p *Program) EmitWithPluginTransformers(transforms []PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, errors.New("driver: nil program")
  }
  host := &pluginEmitHost{program: p.TSProgram, emitResolver: p.Checker.GetEmitResolver()}
  options := p.TSProgram.Options()
  newLine := options.NewLine.GetNewLineCharacter()
  for _, sf := range shimcompiler.GetSourceFilesToEmit(host, nil, false) {
    ec := shimprinter.NewEmitContext()
    out := sf
    for _, transform := range transforms {
      if transform == nil {
        continue
      }
      if next := transform(ec, out); next != nil {
        out = next
      }
    }
    shimast.SetParentInChildrenUnset(out.AsNode())
    for _, tr := range shimcompiler.GetScriptTransformers(ec, host, out) {
      out = tr.TransformSourceFile(out)
    }
    paths := shimcompiler.GetOutputPathsFor(sf, options, host, false)
    writer := shimprinter.NewTextWriter(newLine, 0)
    p2 := shimprinter.NewPrinter(shimprinter.PrinterOptions{NewLine: options.NewLine}, shimprinter.PrintHandlers{}, ec)
    p2.Write(out.AsNode(), out, writer, nil)
    if err := writeFile(paths.JsFilePath(), writer.String(), nil); err != nil {
      return nil, err
    }
  }
  return nil, nil
}
