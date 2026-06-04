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
func (h *pluginEmitHost) GetEmitResolver() shimprinter.EmitResolver { return h.emitResolver }
func (h *pluginEmitHost) GetProjectReferenceFromSource(path shimtspath.Path) *shimtsoptions.SourceOutputAndProjectReference {
  return h.program.GetProjectReferenceFromSource(path)
}
func (h *pluginEmitHost) IsSourceFileFromExternalLibrary(file *shimast.SourceFile) bool {
  return h.program.IsSourceFileFromExternalLibrary(file)
}

// PluginTransform builds a per-file emit transformer (a node visitor) bound to
// the emit EmitContext, so nodes it creates with ec.Factory and links with
// ec.SetOriginal are recognized and aliased by tsgo's builtin module-transform.
// This replaces the text-splice plugin contract: a plugin returns AST, not text.
type PluginTransform func(ec *shimprinter.EmitContext, sourceFile *shimast.SourceFile) *shimast.NodeVisitor

// EmitWithPluginTransformer emits every source file by assembling tsgo's emit
// pipeline from shim parts and running the plugin transformer FIRST in the same
// EmitContext as the builtin chain (type-erase, import-elision, module-transform,
// ...). No text-splice and no hand-rolled import aliasing: tsgo's module-transform
// aliases the plugin's nodes itself.
func (p *Program) EmitWithPluginTransformer(transform PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, errors.New("driver: nil program")
  }
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, err
  }
  host := &pluginEmitHost{program: p.TSProgram, emitResolver: p.Checker.GetEmitResolver()}
  options := p.TSProgram.Options()
  newLine := options.NewLine.GetNewLineCharacter()
  for _, sf := range shimcompiler.GetSourceFilesToEmit(host, nil, false) {
    ec := shimprinter.NewEmitContext()
    transformed := transform(ec, sf).VisitSourceFile(sf)
    shimast.SetParentInChildren(transformed.AsNode())
    out := transformed
    for _, tr := range shimcompiler.GetScriptTransformers(ec, host, transformed) {
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
