//go:build ttsc_typescript_7_1

package driver

import (
  "context"
  "strings"

  ast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// programRootMembership uses the 7.1 supported-extension APIs with the Program's
// actual mapper extensions. No root selection is reimplemented here.
func programRootMembership(prog *Program) *TransformMembership {
  if prog.ParsedConfig == nil || prog.ParsedConfig.CompilerOptions() == nil {
    return nil
  }
  options := prog.ParsedConfig.CompilerOptions()
  groups := shimtsoptions.GetSupportedExtensions(options, prog.TSProgram.ContentMapperExtensions())
  return transformMembership(prog, shimtsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(options, groups))
}

// TypeScript 7.1 compiler target.
//
// The driver's emit and diagnostic glue calls compiler APIs whose signatures
// and semantics differ between the 7.0 and 7.1 compilers. Each function here
// makes the 7.1 call; target_ts70.go declares the same functions over the 7.0
// compiler. The ttsc_typescript_7_1 build tag selects this file.

// CaseSensitivity is the 7.1 EmitHost case policy.
func (h *pluginEmitHost) CaseSensitivity() shimtspath.CaseSensitivity {
  return shimcompiler.ProgramCaseSensitivity(h.program)
}

// BaseDirectory is the 7.1 EmitHost project directory.
func (h *pluginEmitHost) BaseDirectory() shimtspath.RootedDirectoryPath {
  return h.program.BaseDirectory()
}

// ContentMapperExtensions is the 7.1 EmitHost list of content-mapper extensions.
func (h *pluginEmitHost) ContentMapperExtensions() []string {
  return h.program.ContentMapperExtensions()
}

// ContentMapperExtensionRewrites is the 7.1 EmitHost list of content-mapper
// output extension rewrites.
func (h *pluginEmitHost) ContentMapperExtensionRewrites() []shimtspath.ExtensionRewrite {
  return h.program.ContentMapperExtensionRewrites()
}

// NewEmitResolver is the 7.1 EmitHost resolver for one emit context, guarded
// to the program's original member accesses.
func (h *pluginEmitHost) NewEmitResolver(emitContext *shimprinter.EmitContext) shimprinter.EmitResolver {
  return guardedEmitResolver{h.checker.NewEmitResolver(emitContext), h.originalMembers}
}

// handleNoEmit applies noEmitOnError's whole-program diagnostic gate. A nil
// result means emit may proceed.
func handleNoEmit(ctx context.Context, program *shimcompiler.Program) *shimcompiler.EmitResult {
  return shimcompiler.HandleNoEmitOptions(ctx, program, nil, nil)
}

// applyScriptTransformers runs the compiler's script transformers for source
// over tree, resolving through host's guarded emit resolver, and returns the
// transformed tree.
func applyScriptTransformers(emitContext *shimprinter.EmitContext, host *pluginEmitHost, source *ast.SourceFile, tree *ast.SourceFile) *ast.SourceFile {
  for _, transformer := range shimcompiler.GetScriptTransformers(host.NewEmitResolver(emitContext), host, source) {
    tree = transformer.TransformSourceFile(tree)
  }
  return tree
}

// scriptWriteFileData is the WriteFileData the 7.1 emitter passes with a
// JavaScript output: its source-map URL position and its source file.
func scriptWriteFileData(source *ast.SourceFile, sourceMapURLPos int) *shimcompiler.WriteFileData {
  return &shimcompiler.WriteFileData{SourceMapUrlPos: sourceMapURLPos, SourceFile: source}
}

// sourceMapWriteFileData is the WriteFileData the 7.1 emitter passes with a
// source map: only its source file.
func sourceMapWriteFileData(source *ast.SourceFile) *shimcompiler.WriteFileData {
  return &shimcompiler.WriteFileData{SourceFile: source}
}

// declarationShapeEmitOptions returns the forced declaration emit of one file
// that the declaration-shape digest reads.
func declarationShapeEmitOptions(file *ast.SourceFile, writeFile shimcompiler.WriteFile) shimcompiler.EmitOptions {
  return shimcompiler.EmitOptions{TargetSourceFiles: []*ast.SourceFile{file}, EmitOnly: shimcompiler.EmitOnlyBuilderSignature, WriteFile: writeFile}
}

// writeDeclarationShapeDiagnosticFile writes how upstream incremental names a
// diagnostic's file relative to the file whose signature it belongs to.
func writeDeclarationShapeDiagnosticFile(builder *strings.Builder, source *ast.SourceFile, diagnosticFile *ast.SourceFile) {
  if relative, ok := shimtspath.CaseInsensitive.RelativePathFromFile(source.FileName(), diagnosticFile.FileName()); ok {
    builder.WriteString(string(relative.AsModuleSpecifier()))
  } else {
    builder.WriteString(string(diagnosticFile.FileName()))
  }
}

// fileDiagnostics returns the bind and semantic diagnostics of one file under
// the compiler's any-program diagnostic rules.
func fileDiagnostics(ctx context.Context, program *shimcompiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
  return shimcompiler.GetDiagnosticsOfAnyProgram(ctx, program, []*ast.SourceFile{file}, false, program.GetBindDiagnostics, program.GetSemanticDiagnostics)
}
