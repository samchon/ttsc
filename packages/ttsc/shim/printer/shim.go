package printer

import (
  "github.com/microsoft/typescript-go/internal/ast"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

type PrintHandlers = innerprinter.PrintHandlers
type Printer = innerprinter.Printer
type PrinterOptions = innerprinter.PrinterOptions
type EmitContext = innerprinter.EmitContext

func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
  return innerprinter.NewPrinter(options, handlers, emitContext)
}

func NewEmitContext() *EmitContext {
  return innerprinter.NewEmitContext()
}

func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
  return p.EmitSourceFile(sourceFile)
}
