// Package printer re-exports the typescript-go internal/printer types that the
// ttsc driver and transform plugins need to emit source text and allocate
// collision-safe generated identifiers. The surface is intentionally narrow.
package printer

import (
  "github.com/microsoft/typescript-go/internal/ast"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

// PrintHandlers provides optional hooks (e.g. substituteNode) called during
// AST emission.
type PrintHandlers = innerprinter.PrintHandlers

// Printer holds the stateful emitter produced by NewPrinter.
type Printer = innerprinter.Printer

// PrinterOptions configures newline style, source-map generation, and other
// emission knobs.
type PrinterOptions = innerprinter.PrinterOptions

// EmitContext accumulates per-emit metadata (source maps, comment positions)
// and must be created fresh for each emit round via NewEmitContext.
type EmitContext = innerprinter.EmitContext

// AutoGenerateOptions configures how NodeFactory allocates generated names.
type AutoGenerateOptions = innerprinter.AutoGenerateOptions

// GeneratedIdentifierFlags controls generated-name scope and collision checks.
type GeneratedIdentifierFlags = innerprinter.GeneratedIdentifierFlags

const (
  GeneratedIdentifierFlagsNone                   = innerprinter.GeneratedIdentifierFlagsNone
  GeneratedIdentifierFlagsAuto                   = innerprinter.GeneratedIdentifierFlagsAuto
  GeneratedIdentifierFlagsLoop                   = innerprinter.GeneratedIdentifierFlagsLoop
  GeneratedIdentifierFlagsUnique                 = innerprinter.GeneratedIdentifierFlagsUnique
  GeneratedIdentifierFlagsNode                   = innerprinter.GeneratedIdentifierFlagsNode
  GeneratedIdentifierFlagsKindMask               = innerprinter.GeneratedIdentifierFlagsKindMask
  GeneratedIdentifierFlagsReservedInNestedScopes = innerprinter.GeneratedIdentifierFlagsReservedInNestedScopes
  GeneratedIdentifierFlagsOptimistic             = innerprinter.GeneratedIdentifierFlagsOptimistic
  GeneratedIdentifierFlagsFileLevel              = innerprinter.GeneratedIdentifierFlagsFileLevel
  GeneratedIdentifierFlagsAllowNameSubstitution  = innerprinter.GeneratedIdentifierFlagsAllowNameSubstitution
)

// NewPrinter creates an emitter with the supplied options, substitution hooks,
// and emit context. Callers must pass the same EmitContext to all operations
// in a single emit round.
func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
  return innerprinter.NewPrinter(options, handlers, emitContext)
}

// NewEmitContext allocates a fresh EmitContext for a new emit round.
func NewEmitContext() *EmitContext {
  return innerprinter.NewEmitContext()
}

// EmitSourceFile renders the full source file through the printer and returns
// the emitted text.
func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
  return p.EmitSourceFile(sourceFile)
}
