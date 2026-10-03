package printer

type PrintHandlers struct{}
type Printer struct{}
type PrinterOptions struct{}

func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext any) *Printer {
  return &Printer{}
}

func EmitSourceFile(p *Printer, sourceFile any) string {
  return ""
}

func Marker() string {
  return "source-plugin-printer"
}
