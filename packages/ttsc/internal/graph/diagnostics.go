package graph

import "github.com/samchon/ttsc/packages/ttsc/driver"

// FileDiagnostics returns the resident program's diagnostics for the source file
// at path, in the same code and location tsgo reports. Because the graph rides
// the already-open Program, this is one Program.Diagnostics() call over the warm
// checker, not a second compile and not an external language-server round-trip:
// "what is wrong with this file" is answered from the same handle that built the
// reference graph. These are the compiler's own diagnostics; lint findings are
// deliberately not merged here, since @ttsc/lint is a separate Go module and
// importing it would couple the graph binary to the lint engine across a module
// boundary the workspace keeps apart (see linthost/host.go). Lint stays reachable
// through @ttsc/lint's own CLI and LSP.
func FileDiagnostics(prog *driver.Program, path string) []driver.Diagnostic {
  out := make([]driver.Diagnostic, 0)
  for _, diagnostic := range prog.Diagnostics() {
    if diagnostic.File == path {
      out = append(out, diagnostic)
    }
  }
  return out
}
