//go:build ttsc_typescript_7_1

package driver_test

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

func (h *assembledEmitHost) CaseSensitivity() shimtspath.CaseSensitivity {
  return shimcompiler.ProgramCaseSensitivity(h.program)
}
func (h *assembledEmitHost) BaseDirectory() shimtspath.RootedDirectoryPath {
  return h.program.BaseDirectory()
}
func (h *assembledEmitHost) ContentMapperExtensions() []string {
  return h.program.ContentMapperExtensions()
}
func (h *assembledEmitHost) ContentMapperExtensionRewrites() []shimtspath.ExtensionRewrite {
  return h.program.ContentMapperExtensionRewrites()
}
func (h *assembledEmitHost) NewEmitResolver(emitContext *shimprinter.EmitContext) shimprinter.EmitResolver {
  return h.checker.NewEmitResolver(emitContext)
}

// applyAssembledBuiltins runs the TypeScript 7.1 builtin emit chain for source
// over tree, with an emit resolver created for emitContext.
func applyAssembledBuiltins(emitContext *shimprinter.EmitContext, host *assembledEmitHost, source *shimast.SourceFile, tree *shimast.SourceFile) *shimast.SourceFile {
  for _, transformer := range shimcompiler.GetScriptTransformers(host.NewEmitResolver(emitContext), host, source) {
    tree = transformer.TransformSourceFile(tree)
  }
  return tree
}
