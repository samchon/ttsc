package printer

import (
	"github.com/microsoft/typescript-go/internal/ast"
	innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

type PrintHandlers = innerprinter.PrintHandlers
type Printer = innerprinter.Printer
type PrinterOptions = innerprinter.PrinterOptions

func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *innerprinter.EmitContext) *Printer {
	return innerprinter.NewPrinter(options, handlers, emitContext)
}

func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
	return p.EmitSourceFile(sourceFile)
}
