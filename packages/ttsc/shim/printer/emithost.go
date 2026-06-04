// gen_shims:hand-maintained
//
// Re-exports the emit host/resolver interfaces so ttsc's driver can implement
// its own EmitHost (delegating to driver.Program) and hand it to
// compiler.GetScriptTransformers when assembling the emit pipeline.
package printer

import innerprinter "github.com/microsoft/typescript-go/internal/printer"

// EmitHost is the per-emit host interface tsgo's transformers query (Options,
// SourceFiles, GetEmitResolver, GetEmitModuleFormatOfFile, WriteFile, ...).
type EmitHost = innerprinter.EmitHost

// EmitResolver resolves emit-time facts about nodes (referenced imports,
// declaration flags, ...) under the checker mutex.
type EmitResolver = innerprinter.EmitResolver

// EmitTextWriter is the sink the printer emits into; String() yields the text.
type EmitTextWriter = innerprinter.EmitTextWriter

// NewTextWriter creates a fresh writer for one emit (newLine e.g. "\n").
func NewTextWriter(newLine string, indentSize int) EmitTextWriter {
  return innerprinter.NewTextWriter(newLine, indentSize)
}
