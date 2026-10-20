//go:build !ttsc_typescript_7_1

package driver_test

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
)

func (h *assembledEmitHost) UseCaseSensitiveFileNames() bool {
  return h.program.UseCaseSensitiveFileNames()
}
func (h *assembledEmitHost) GetCurrentDirectory() string { return h.program.GetCurrentDirectory() }
func (h *assembledEmitHost) GetEmitResolver() shimprinter.EmitResolver {
  return h.checker.GetEmitResolver()
}

// applyAssembledBuiltins runs the TypeScript 7.0 builtin emit chain for source
// over tree in emitContext; the transformers read host.GetEmitResolver.
func applyAssembledBuiltins(emitContext *shimprinter.EmitContext, host *assembledEmitHost, source *shimast.SourceFile, tree *shimast.SourceFile) *shimast.SourceFile {
  for _, transformer := range shimcompiler.GetScriptTransformers(emitContext, host, source) {
    tree = transformer.TransformSourceFile(tree)
  }
  return tree
}
