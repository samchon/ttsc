//go:build !ttsc_typescript_7_1

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

// programRootMembership uses the 7.0 supported-extension APIs and effective
// parsed options. A facade constructed without parsed config has no report.
func programRootMembership(prog *Program) *TransformMembership {
  if prog.ParsedConfig == nil || prog.ParsedConfig.CompilerOptions() == nil {
    return nil
  }
  options := prog.ParsedConfig.CompilerOptions()
  groups := shimtsoptions.GetSupportedExtensions(options, nil)
  return transformMembership(prog, shimtsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(options, groups))
}

// TypeScript 7.0 compiler target.
//
// The driver's emit and diagnostic glue calls compiler APIs whose signatures
// and semantics differ between the 7.0 and 7.1 compilers. Each function here
// keeps the call the driver made on 7.0; target_ts71.go declares the same
// functions over the 7.1 compiler. The ttsc_typescript_7_1 build tag selects
// 7.1, and its absence selects this file.

// UseCaseSensitiveFileNames is the 7.0 EmitHost case policy.
func (h *pluginEmitHost) UseCaseSensitiveFileNames() bool {
  return h.program.UseCaseSensitiveFileNames()
}

// GetCurrentDirectory is the 7.0 EmitHost working directory.
func (h *pluginEmitHost) GetCurrentDirectory() string { return h.program.GetCurrentDirectory() }

// GetEmitResolver is the 7.0 EmitHost resolver: the checker's single resolver,
// guarded to the program's original member accesses.
func (h *pluginEmitHost) GetEmitResolver() shimprinter.EmitResolver {
  return guardedEmitResolver{h.checker.GetEmitResolver(), h.originalMembers}
}

// handleNoEmit applies noEmitOnError's whole-program diagnostic gate. A nil
// result means emit may proceed.
func handleNoEmit(ctx context.Context, program *shimcompiler.Program) *shimcompiler.EmitResult {
  return shimcompiler.HandleNoEmitOnError(ctx, program, nil)
}

// applyScriptTransformers runs the compiler's script transformers for source
// over tree, resolving through host's guarded emit resolver, and returns the
// transformed tree.
func applyScriptTransformers(emitContext *shimprinter.EmitContext, host *pluginEmitHost, source *ast.SourceFile, tree *ast.SourceFile) *ast.SourceFile {
  for _, transformer := range shimcompiler.GetScriptTransformers(emitContext, host, source) {
    tree = transformer.TransformSourceFile(tree)
  }
  return tree
}

// scriptWriteFileData is the WriteFileData the 7.0 emitter passes with a
// JavaScript output: only its source-map URL position.
func scriptWriteFileData(source *ast.SourceFile, sourceMapURLPos int) *shimcompiler.WriteFileData {
  return &shimcompiler.WriteFileData{SourceMapUrlPos: sourceMapURLPos}
}

// sourceMapWriteFileData is the WriteFileData the 7.0 emitter passes with a
// source map: none.
func sourceMapWriteFileData(source *ast.SourceFile) *shimcompiler.WriteFileData {
  return nil
}

// declarationShapeEmitOptions returns the forced declaration emit of one file
// that the declaration-shape digest reads.
func declarationShapeEmitOptions(file *ast.SourceFile, writeFile shimcompiler.WriteFile) shimcompiler.EmitOptions {
  return shimcompiler.EmitOptions{TargetSourceFile: file, EmitOnly: shimcompiler.EmitOnlyForcedDts, WriteFile: writeFile}
}

// writeDeclarationShapeDiagnosticFile writes how upstream incremental names a
// diagnostic's file relative to the file whose signature it belongs to.
func writeDeclarationShapeDiagnosticFile(builder *strings.Builder, source *ast.SourceFile, diagnosticFile *ast.SourceFile) {
  builder.WriteString(shimtspath.EnsurePathIsNonModuleName(shimtspath.GetRelativePathFromDirectory(
    shimtspath.GetDirectoryPath(string(source.Path())),
    string(diagnosticFile.Path()),
    shimtspath.ComparePathsOptions{},
  )))
}

// fileDiagnostics returns the bind and semantic diagnostics of one file under
// the compiler's any-program diagnostic rules.
func fileDiagnostics(ctx context.Context, program *shimcompiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
  return shimcompiler.GetDiagnosticsOfAnyProgram(ctx, program, file, false, program.GetBindDiagnostics, program.GetSemanticDiagnostics)
}
