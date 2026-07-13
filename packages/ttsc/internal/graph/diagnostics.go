package graph

import "github.com/samchon/ttsc/packages/ttsc/driver"

// FileDiagnostics returns the resident program's compiler diagnostics for the
// source file at path, in the same code and location tsgo reports. Because the
// graph rides the already-open Program, this is one Program.Diagnostics() call
// over the warm checker, not a second compile.
//
// This is the compiler-only slice: it carries the TypeScript semantic
// diagnostics, not @ttsc/lint or transform-plugin findings. Nothing in the
// graph pipeline calls it yet; the dump and MCP results carry no diagnostics.
// This helper and its tests pin the compiler-diagnostic conversion (code,
// column, message) so a future diagnostics integration starts from a proven
// producer.
func FileDiagnostics(prog *driver.Program, path string) []driver.Diagnostic {
  out := make([]driver.Diagnostic, 0)
  for _, diagnostic := range prog.Diagnostics() {
    if diagnostic.File == path {
      out = append(out, diagnostic)
    }
  }
  return out
}
